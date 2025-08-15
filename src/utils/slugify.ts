export function slugify(text: string): string {
    const turkishChars: { [key: string]: string } = {
        'ı': 'i',
        'ğ': 'g',
        'ü': 'u',
        'ş': 's',
        'ö': 'o',
        'ç': 'c',
        'İ': 'I',
        'Ğ': 'G',
        'Ü': 'U',
        'Ş': 'S',
        'Ö': 'O',
        'Ç': 'C'
    };

    return text
        .toLowerCase()
        .replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ\s]/g, '') // Remove special chars except Turkish chars
        .replace(/\s+/g, '-') // Replace spaces with -
        .replace(/[ğüşöçı]/g, m => turkishChars[m]) // Convert Turkish chars to English equivalents
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing -
}