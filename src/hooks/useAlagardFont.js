import { useFonts } from 'expo-font';

const MODULE_FONT_FAMILY = 'alagard';

export function useAlagardFont() {
    return useFonts({
        [MODULE_FONT_FAMILY]: require('../../assets/alagard.ttf'),
    });
}

export { MODULE_FONT_FAMILY };