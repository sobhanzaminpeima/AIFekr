import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, InputField, LoadingState } from "./index";
import { foundationCopy, type UiLocale } from "@/lib/i18n/foundation";

describe('foundation accessibility contracts', () => {
  it('does not submit a form by default, and blocks repeat submission while loading', () => {
    const defaultButton = renderToStaticMarkup(createElement(Button, { locale: 'fa' }, 'ذخیره'));
    expect(defaultButton).toContain('type="button"');
    const loading = renderToStaticMarkup(createElement(Button, { locale: 'de', loading: true, type: 'submit' }, 'Speichern'));
    expect(loading).toContain('disabled=""');
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain(foundationCopy.de.loading);
  });
  it('associates a unique label, hint and error with the input, preserving external descriptions', () => {
    const html = renderToStaticMarkup(createElement(InputField, { id: 'business', label: 'Business', hint: 'Registered name', error: 'Required', 'aria-describedby': 'external' }));
    expect(html).toContain('for="business"');
    expect(html).toContain('aria-describedby="external business-hint business-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('id="business-error" role="alert"');
  });
  it.each<UiLocale>(['fa', 'en', 'de'])('announces loading in %s without exposing decorative skeletons', (locale) => {
    const html = renderToStaticMarkup(createElement(LoadingState, { locale }));
    expect(html).toContain('role="status"');
    expect(html).toContain(foundationCopy[locale].loading);
    expect(html).toContain('aria-hidden="true"');
  });
});
