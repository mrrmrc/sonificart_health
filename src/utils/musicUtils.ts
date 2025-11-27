

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const scales = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10]
};

function getRootNote(keyString: string): number {
    const notePart = keyString.split(' ')[0];
    const rootIndex = noteNames.findIndex(n => n.startsWith(notePart.charAt(0)));
    if (notePart.includes('#') || notePart.includes('♯')) return (rootIndex + 1) % 12;
    if (notePart.includes('b') || notePart.includes('♭')) return (rootIndex - 1 + 12) % 12;
    return rootIndex;
}
