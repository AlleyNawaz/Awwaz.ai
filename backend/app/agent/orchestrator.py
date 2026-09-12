from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from app.agent.schemas import AgentResponse, AgentTraceStep, ExtractionResult
from app.agent.context import ContextBuilder
from app.agent.tools import AgentTools
from app.integrations.llm.interface import LLMProvider
from app.integrations.llm.fixture_provider import FixtureLLMProvider
from app.core.config import settings
from app.repositories.models import MessageModel, ConversationModel, ComplaintEventModel
from app.domain.routing.service import RoutingService
from app.domain.complaints.entities import ComplaintCategory, Priority


class AgentOrchestrator:
    def __init__(self, llm_provider: Optional[LLMProvider] = None):
        if llm_provider:
            self.provider = llm_provider
        elif settings.LLM_PROVIDER == "fixture":
            self.provider = FixtureLLMProvider()
        else:
            self.provider = FixtureLLMProvider()

    async def process_user_message(
        self,
        session: AsyncSession,
        conversation_id: str,
        citizen_id: str,
        user_message: str,
        current_user: Dict[str, Any],
        request_id: Optional[str] = None,
    ) -> AgentResponse:
        trace: List[AgentTraceStep] = []
        step_counter = 1

        # Step 1: Record citizen message
        citizen_msg = MessageModel(
            conversation_id=conversation_id,
            sender_type="CITIZEN",
            content=user_message,
        )
        session.add(citizen_msg)
        await session.commit()

        trace.append(
            AgentTraceStep(
                step=step_counter,
                action="MESSAGE_RECEIVED",
                details={"preview": user_message[:60]},
            )
        )
        step_counter += 1

        # Step 2: Assemble Context
        context = await ContextBuilder.build_agent_context(
            session=session,
            conversation_id=conversation_id,
            citizen_id=citizen_id,
        )

        trace.append(
            AgentTraceStep(
                step=step_counter,
                action="CONTEXT_ASSEMBLED",
                details={
                    "history_turns": len(context["history"]),
                    "prior_cases": len(context["previous_complaints"]),
                },
            )
        )
        step_counter += 1

        # Step 3: LLM Extraction & Interpretation
        extraction: ExtractionResult = await self.provider.extract_complaint(
            message=user_message,
            conversation_history=context["history"],
            context=context,
        )

        trace.append(
            AgentTraceStep(
                step=step_counter,
                action="INTENT_CLASSIFIED",
                details={
                    "intent": extraction.intent,
                    "category": extraction.category,
                    "confidence": extraction.confidence,
                },
            )
        )
        step_counter += 1

        # Step 4: Prompt Injection Filter
        if extraction.intent == "SECURITY_DEFENSE_TRIGGERED":
            reply_text = "Your request contains untrusted instructions attempting to bypass security boundaries. This system strictly maintains human authorization for all actions."
            agent_msg = MessageModel(
                conversation_id=conversation_id,
                sender_type="AGENT",
                content=reply_text,
            )
            session.add(agent_msg)
            await session.commit()
            return AgentResponse(
                reply_text=reply_text,
                intent="SECURITY_DEFENSE_TRIGGERED",
                clarification_required=False,
                trace=trace,
            )

        # Step 5: Check Missing Critical Fields (e.g. Location)
        if "location" in extraction.missing_fields or not extraction.location_text:
            trace.append(
                AgentTraceStep(
                    step=step_counter,
                    action="CLARIFICATION_TRIGGERED",
                    details={"missing_field": "location"},
                )
            )

            # Multilingual helpful clarification
            cat_label = extraction.category.replace("_", " ").title()
            reply_text = (
                f"Awwaz has understood your report regarding {cat_label}.\n"
                f"To route this to the appropriate field unit, please provide the exact location or a nearby landmark (e.g. 'Near ABC Chowk, Sector G-9')."
            )

            agent_msg = MessageModel(
                conversation_id=conversation_id,
                sender_type="AGENT",
                content=reply_text,
            )
            session.add(agent_msg)
            await session.commit()

            return AgentResponse(
                reply_text=reply_text,
                intent=extraction.intent,
                category=extraction.category,
                clarification_required=True,
                missing_fields=["location"],
                trace=trace,
            )

        # Step 6: Location is available -> Execute create_case tool
        trace.append(
            AgentTraceStep(
                step=step_counter,
                action="CALLING_ROUTING_TOOL",
                tool_name="create_case",
                details={"category": extraction.category, "location": extraction.location_text},
            )
        )
        step_counter += 1

        case_result = await AgentTools.create_case(
            session=session,
            citizen_id=citizen_id,
            title=extraction.title,
            description=extraction.description,
            category=extraction.category,
            location_text=extraction.location_text,
            priority=extraction.priority,
            actor_user=current_user,
        )

        trace.append(
            AgentTraceStep(
                step=step_counter,
                action="CASE_CREATED_AND_ROUTED",
                tool_name="create_case",
                details={
                    "complaint_id": case_result["complaint_id"],
                    "status": case_result["status"],
                    "responsibility": case_result["responsibility"],
                },
            )
        )

        dept_info = RoutingService.get_initial_assignment(extraction.category)
        reply_text = (
            f"Your complaint has been successfully registered and assigned!\n\n"
            f"• Case Title: {extraction.title}\n"
            f"• Category: {extraction.category.replace('_', ' ').title()}\n"
            f"• Department: {dept_info['department_name']}\n"
            f"• Responsible Desk: {dept_info['responsibility_name']}\n"
            f"• Location: {extraction.location_text}\n\n"
            f"Awwaz is now tracking what happens next on your timeline."
        )

        agent_msg = MessageModel(
            conversation_id=conversation_id,
            sender_type="AGENT",
            content=reply_text,
            metadata_json={"complaint_id": case_result["complaint_id"]},
        )
        session.add(agent_msg)
        await session.commit()

        return AgentResponse(
            reply_text=reply_text,
            intent=extraction.intent,
            category=extraction.category,
            clarification_required=False,
            complaint_id=case_result["complaint_id"],
            complaint_title=extraction.title,
            department_name=dept_info["department_name"],
            trace=trace,
        )
