'use client';

import { Segmented } from '@/components/ui/Segmented';
import { hasLanguage, LANGUAGE_NAMES, MESSAGE_LANGUAGES } from '@/lib/messaging';
import type { MessageLanguage, MessageTemplate } from '@/lib/types';

/** Languages without a WhatsApp text in the template are shown but cannot be chosen. */
export function LanguagePicker({
  value,
  onChange,
  template,
}: {
  value: MessageLanguage;
  onChange: (language: MessageLanguage) => void;
  template: MessageTemplate | null;
}) {
  return (
    <Segmented
      value={value}
      onChange={onChange}
      options={MESSAGE_LANGUAGES.map((l) => {
        const available = hasLanguage(template, l.value);
        return {
          value: l.value,
          label: l.label,
          disabled: !available,
          title: available ? undefined : `Ce modèle n’a pas encore de version en ${LANGUAGE_NAMES[l.value]}.`,
        };
      })}
    />
  );
}

/** The chosen language, or French when the template has no text in it. */
export function effectiveLanguage(template: MessageTemplate | null, language: MessageLanguage): MessageLanguage {
  return hasLanguage(template, language) ? language : 'fr';
}
