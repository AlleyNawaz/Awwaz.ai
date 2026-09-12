const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = path.join(__dirname, '../video_frames');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function capture() {
  console.log('Launching Chrome for video capture...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080',
      '--hide-scrollbars',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });

  // Scene 1: Homepage Hero (Problem & Hook)
  console.log('Capturing Scene 1: Homepage...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'scene_01_hero.png') });

  // Scene 2: Interactive Tabs (Tab 1: Intake)
  console.log('Capturing Scene 2: Interactive Tabs...');
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'scene_02_hook.png') });

  // Scene 3: Citizen Intake Chat
  console.log('Capturing Scene 3: Citizen Intake...');
  await page.goto('http://localhost:3000/citizen', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'scene_03_citizen_empty.png') });

  // Type message in Roman Urdu
  const inputSelector = 'input[type="text"]';
  await page.waitForSelector(inputSelector);
  await page.type(inputSelector, 'Bhai 3 din se G-9 markaz me gutter overflow ho raha hai aur ganda pani dukanon me ghus raha hai', { delay: 25 });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'scene_03_citizen_typed.png') });

  // Click send button
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'scene_03_citizen_replied.png') });

  // Scene 3.4: Citizen Case View
  console.log('Capturing Scene 3.4: Citizen Case Detail...');
  await page.goto('http://localhost:3000/citizen/complaints/A1024', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'scene_03_citizen_case.png') });

  // Scene 4: Command Center Dashboard
  console.log('Capturing Scene 4: Command Center Dashboard...');
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'scene_04_dashboard.png') });

  // Scene 4.2: Case Detail Operator View
  console.log('Capturing Scene 4.2: Operator Case Dossier...');
  await page.goto('http://localhost:3000/dashboard/complaints/A1024', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'scene_04_case_dossier.png') });

  // Scene 5: Approvals Queue & Modal
  console.log('Capturing Scene 5: Approvals Queue...');
  await page.goto('http://localhost:3000/dashboard/approvals', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'scene_05_approvals_list.png') });

  // Click Review & Authorize Action to open modal
  const reviewBtn = await page.$('button.btn-primary');
  if (reviewBtn) {
    await reviewBtn.click();
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'scene_05_approval_modal.png') });
  }

  // Scene 6: Admin Cryptographic Ledger
  console.log('Capturing Scene 6: Admin Cryptographic Ledger...');
  await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'scene_06_admin_ledger.png') });

  // Scene 7: Hero Outro
  console.log('Capturing Scene 7: Outro...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'scene_07_outro.png') });

  await browser.close();
  console.log('All scenes captured successfully!');
}

capture().catch(err => {
  console.error('Error capturing scenes:', err);
  process.exit(1);
});
