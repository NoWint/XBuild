// C2 persona preference (preferences.json key `persona`). Pure: imported by
// both the main process (settingsPatch) and the renderer (persona-store).
// Renderer copy only; nothing here ever reaches the model.
import { t } from '../i18n/index.mjs';
export const SPARK_ICONS = Object.freeze(['spark', 'star', 'lightning', 'chat', 'custom']);
export const PERSONA_DEFAULT = Object.freeze({ assistantName: '', greeting: '', sparkIcon: 'spark', sparkImage: '' });
export const DEFAULT = PERSONA_DEFAULT;
export const ASSISTANT_NAME_MAX = 40;
export const GREETING_MAX = 120;
export const SPARK_IMAGE_MAX = 350000;
const IMAGE = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\x00-\x1f\x7f]/;

export function isSparkImage(value) {
  return typeof value === 'string' && value.length <= SPARK_IMAGE_MAX && IMAGE.test(value);
}
function nameError(value) {
  if (typeof value !== 'string') return t('Enter a name.');
  const name = value.trim();
  if (name.length > ASSISTANT_NAME_MAX) return t('Use {max} characters or fewer.', { max: ASSISTANT_NAME_MAX });
  if (CONTROL.test(name) || /[<>]/.test(name)) return t('The name can’t contain < or > or control characters.');
  return null;
}
function greetingError(value) {
  if (typeof value !== 'string') return t('Enter a greeting.');
  const text = value.trim();
  if (text.length > GREETING_MAX) return t('Use {max} characters or fewer.', { max: GREETING_MAX });
  if (CONTROL.test(text)) return t('The greeting can’t contain control characters.');
  return null;
}
/** Single-field checks for the Settings text fields (null when valid). */
export function assistantNameError(value) { return nameError(value); }
export function personaGreetingError(value) { return greetingError(value); }

/** Lenient read: any invalid field falls back to its default. */
export function normalize(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const assistantName = typeof input.assistantName === 'string' && !nameError(input.assistantName) ? input.assistantName.trim() : '';
  const greeting = typeof input.greeting === 'string' && !greetingError(input.greeting) ? input.greeting.trim() : '';
  const sparkImage = isSparkImage(input.sparkImage) ? input.sparkImage : '';
  let sparkIcon = SPARK_ICONS.includes(input.sparkIcon) ? input.sparkIcon : 'spark';
  if (sparkIcon === 'custom' && !sparkImage) sparkIcon = 'spark';
  return { assistantName, greeting, sparkIcon, sparkImage };
}

/** Strict write check: throws a user-facing Error; null resets to the default. */
export function validate(value) {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(t('Invalid persona setting.'));
  const merged = { ...PERSONA_DEFAULT, ...value };
  for (const key of Object.keys(value)) if (!(key in PERSONA_DEFAULT)) throw new Error(t('Invalid persona setting.'));
  const name = nameError(merged.assistantName);
  if (name) throw new Error(name);
  const greeting = greetingError(merged.greeting);
  if (greeting) throw new Error(greeting);
  if (!SPARK_ICONS.includes(merged.sparkIcon)) throw new Error(t('Choose an assistant icon.'));
  if (typeof merged.sparkImage !== 'string') throw new Error(t('Invalid assistant image.'));
  if (merged.sparkImage && !isSparkImage(merged.sparkImage))
    throw new Error(merged.sparkImage.length > SPARK_IMAGE_MAX ? t('The image is too large. Choose one under 256 KB.') : t('Choose a PNG, JPEG, WebP or SVG image.'));
  if (merged.sparkIcon === 'custom' && !merged.sparkImage) throw new Error(t('Choose an image for the custom icon.'));
  return { assistantName: merged.assistantName.trim(), greeting: merged.greeting.trim(), sparkIcon: merged.sparkIcon, sparkImage: merged.sparkImage };
}
export const normalizePersona = normalize;
export const validatePersona = validate;
