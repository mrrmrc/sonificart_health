import { fixAudioUrl, reconstructResultFromPartialData } from './src/utils/dataUtils';

function testReconstruction() {
    console.log('--- START TEST ---');

    const legacyEntry = { id: 1, audio_url: '/media/legacy_audio.wav', imageUrl: 'image.jpg', paradigm: 'scientific', configUsed: { pixelCount: 1024, noteDurationSeconds: 0.2 } };
    const resultA = reconstructResultFromPartialData(legacyEntry, 'img.jpg', legacyEntry.audio_url, 'test.sac');
    const passA = resultA.audioOutput.originalArchivedUrl?.includes('https://sonificart.com/media/legacy_audio.wav') && !resultA.audioOutput.customAudioUrl;
    console.log('CASE_A: ' + (passA ? 'SUCCESS' : 'FAILED'));

    const modernEntry = { id: 2, audio_url: '/media/custom/elaborated.mp3', original_audio_url: '/media/sonification.wav', imageUrl: 'image.jpg', paradigm: 'scientific' };
    const resultB = reconstructResultFromPartialData(modernEntry, 'img.jpg', null, 'test.sac');
    const passB = resultB.audioOutput.originalArchivedUrl?.includes('sonification.wav') && resultB.audioOutput.customAudioUrl?.includes('elaborated.mp3');
    console.log('CASE_B: ' + (passB ? 'SUCCESS' : 'FAILED'));

    const passC = fixAudioUrl('/path.wav') === 'https://sonificart.com/path.wav' && fixAudioUrl('https://ext.com/f.mp3') === 'https://ext.com/f.mp3';
    console.log('CASE_C: ' + (passC ? 'SUCCESS' : 'FAILED'));

    console.log('--- END TEST ---');
}

testReconstruction();