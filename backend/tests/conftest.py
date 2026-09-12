import pytest
import sys
from pathlib import Path
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Add backend to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app
from app.repositories.database import Base, get_db
from app.repositories.models import UserModel, DepartmentModel
from app.domain.routing.mappings import DEFAULT_DEPARTMENTS
from app.core.security import create_session_token, Roles

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        # Seed test users
        session.add_all([
            UserModel(id="test_citizen_1", name="Test Citizen", email="citizen1@test.com", role=Roles.CITIZEN),
            UserModel(id="test_citizen_2", name="Other Citizen", email="citizen2@test.com", role=Roles.CITIZEN),
            UserModel(id="test_operator_1", name="Test Operator", email="operator1@test.com", role=Roles.OPERATOR),
            UserModel(id="test_admin_1", name="Test Admin", email="admin1@test.com", role=Roles.ADMIN),
        ])
        # Seed departments
        for cat, config in DEFAULT_DEPARTMENTS.items():
            session.add(DepartmentModel(
                name=config["name"],
                category=cat,
                active=True,
                escalation_target_id=config["escalation_target"],
                responsibility_chain=config["responsibility_chain"],
            ))
        await session.commit()

        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
def citizen_token() -> str:
    return create_session_token("test_citizen_1", Roles.CITIZEN, "citizen1@test.com", "Test Citizen")


@pytest.fixture
def operator_token() -> str:
    return create_session_token("test_operator_1", Roles.OPERATOR, "operator1@test.com", "Test Operator")


@pytest.fixture
def admin_token() -> str:
    return create_session_token("test_admin_1", Roles.ADMIN, "admin1@test.com", "Test Admin")
