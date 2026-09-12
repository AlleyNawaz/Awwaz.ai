const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const FFMPEG = '/Users/alinawaz/Developer/Awwaz.ai/tools/ffmpeg';
const AUDIO_FILE = '/Users/alinawaz/Downloads/ElevenLabs_2026-09-12T11_10_26_Brian - Deep, Resonant and Comforting_pre_sp100_s50_sb75_se0_b_m2.mp3';
const OUTPUT_VIDEO = '/Users/alinawaz/Developer/Awwaz.ai/Awwaz_Autonomous_Civic_Demo.mp4';
const FRAMES_DIR = '/Users/alinawaz/Developer/Awwaz.ai/video_frames';
const TEMP_DIR = '/Users/alinawaz/Developer/Awwaz.ai/video_temp';

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Scene timeline accurately synchronized to Brian's 128.73s ElevenLabs voiceover
const SCENES = [
  { img: 'scene_01_hero.png', duration: 18.0, name: '01_hero' },
  { img: 'scene_02_hook.png', duration: 6.0, name: '02_hook' },
  { img: 'scene_03_citizen_empty.png', duration: 4.0, name: '03_citizen_empty' },
  { img: 'scene_03_citizen_typed.png', duration: 5.0, name: '03_citizen_typed' },
  { img: 'scene_03_citizen_replied.png', duration: 9.0, name: '03_citizen_replied' },
  { img: 'scene_03_citizen_case.png', duration: 10.0, name: '03_citizen_case' },
  { img: 'scene_04_dashboard.png', duration: 10.0, name: '04_dashboard' },
  { img: 'scene_04_case_dossier.png', duration: 12.0, name: '04_case_dossier' },
  { img: 'scene_05_approvals_list.png', duration: 8.0, name: '05_approvals_list' },
  { img: 'scene_05_approval_modal.png', duration: 14.0, name: '05_approval_modal' },
  { img: 'scene_06_admin_ledger.png', duration: 20.0, name: '06_admin_ledger' },
  { img: 'scene_07_outro.png', duration: 12.73, name: '07_outro' },
];

console.log('Rendering video clips for each scene...');
const clipFiles = [];

SCENES.forEach((scene, index) => {
  const inputImg = path.join(FRAMES_DIR, scene.img);
  const outputClip = path.join(TEMP_DIR, `clip_${String(index).padStart(2, '0')}.mp4`);
  clipFiles.push(outputClip);

  console.log(`Rendering ${scene.name} (${scene.duration}s)...`);
  const cmd = `"${FFMPEG}" -y -loop 1 -i "${inputImg}" -t ${scene.duration} -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p" -r 30 -c:v libx264 -preset fast -crf 18 "${outputClip}"`;
  execSync(cmd, { stdio: 'inherit' });
});

// Create concat list
const concatListFile = path.join(TEMP_DIR, 'concat_list.txt');
const concatContent = clipFiles.map(f => `file '${f}'`).join('\n');
fs.writeFileSync(concatListFile, concatContent);

const silentVideo = path.join(TEMP_DIR, 'silent_full.mp4');
console.log('Concatenating clips into unified video...');
execSync(`"${FFMPEG}" -y -f concat -safe 0 -i "${concatListFile}" -c copy "${silentVideo}"`, { stdio: 'inherit' });

console.log('Muxing video with ElevenLabs voiceover audio...');
execSync(`"${FFMPEG}" -y -i "${silentVideo}" -i "${AUDIO_FILE}" -c:v copy -c:a aac -b:a 192k -shortest "${OUTPUT_VIDEO}"`, { stdio: 'inherit' });

console.log('CLEANUP...');
try {
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
} catch (e) {}

console.log(`SUCCESS! Video rendered to: ${OUTPUT_VIDEO}`);
