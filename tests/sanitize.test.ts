import { describe, it, expect } from 'vitest';
import { sanitizeFrameHTML } from '../src/sanitize';

describe('sanitize', () => {
  describe('sanitizeFrameHTML', () => {
    describe('dangerous tags removal', () => {
      it('removes script tags', () => {
        const html = '<div>Hello<script>alert("xss")</script>World</div>';
        const result = sanitizeFrameHTML(html);

        expect(result).not.toContain('<script>');
        expect(result).not.toContain('alert');
        expect(result).toContain('Hello');
        expect(result).toContain('World');
      });

      it('removes iframe tags', () => {
        const html = '<div><iframe src="evil.com"></iframe>Content</div>';
        const result = sanitizeFrameHTML(html);

        expect(result).not.toContain('<iframe');
        expect(result).toContain('Content');
      });

      it('keeps form controls but removes the submit path', () => {
        const html = '<form action="/steal" method="post"><input type="text" /></form>';
        const result = sanitizeFrameHTML(html);

        expect(result).toContain('<form');
        expect(result).toContain('<input');
        expect(result).not.toContain('action=');
        expect(result).not.toContain('method=');
      });

      it('removes formaction and formtarget from buttons', () => {
        const html = '<button formaction="https://evil.example" formtarget="_blank">Send</button>';
        const result = sanitizeFrameHTML(html);

        expect(result).toContain('<button');
        expect(result).not.toContain('formaction');
        expect(result).not.toContain('formtarget');
      });

      it('removes object and embed tags', () => {
        const html = '<object data="malware.swf"></object><embed src="evil.swf" />';
        const result = sanitizeFrameHTML(html);

        expect(result).not.toContain('<object');
        expect(result).not.toContain('<embed');
      });

      it('removes meta and link tags', () => {
        const html =
          '<meta http-equiv="refresh" content="0;url=evil.com"><link rel="import" href="x">';
        const result = sanitizeFrameHTML(html);

        expect(result).not.toContain('<meta');
        expect(result).not.toContain('<link');
      });

      it('removes frame and frameset tags', () => {
        const html = '<frameset><frame src="evil.html"></frame></frameset>';
        const result = sanitizeFrameHTML(html);

        expect(result).not.toContain('<frameset');
        expect(result).not.toContain('<frame');
      });
    });

    describe('dangerous attributes removal', () => {
      it('removes onclick attribute', () => {
        const html = '<div onclick="alert(1)">Click me</div>';
        const result = sanitizeFrameHTML(html);

        expect(result).not.toContain('onclick');
        expect(result).toContain('Click me');
      });

      it('removes onload attribute', () => {
        const html = '<img src="x" onload="alert(1)" />';
        const result = sanitizeFrameHTML(html);

        expect(result).not.toContain('onload');
      });

      it('removes onerror attribute', () => {
        const html = '<img src="x" onerror="alert(1)" />';
        const result = sanitizeFrameHTML(html);

        expect(result).not.toContain('onerror');
      });

      it('removes onmouseover attribute', () => {
        const html = '<div onmouseover="alert(1)">Hover</div>';
        const result = sanitizeFrameHTML(html);

        expect(result).not.toContain('onmouseover');
      });

      it('removes onfocus and onblur attributes', () => {
        const html = '<a onfocus="alert(1)" onblur="alert(2)">Link</a>';
        const result = sanitizeFrameHTML(html);

        expect(result).not.toContain('onfocus');
        expect(result).not.toContain('onblur');
      });

      it('removes custom on* attributes', () => {
        const html = '<div oncustomevent="alert(1)" ondataload="x">Content</div>';
        const result = sanitizeFrameHTML(html);

        expect(result).not.toContain('oncustomevent');
        expect(result).not.toContain('ondataload');
      });
    });

    describe('unsafe URL removal', () => {
      /**
       * `href`는 태그와 무관하게 항상 제거되므로 scheme 검사에 도달하지 않는다.
       * scheme 검사가 실제로 도는 속성(`src`/`poster`/`cite`/`background`)으로 검증한다.
       */
      it('removes javascript: src', () => {
        const html = '<img src="javascript:alert(1)" alt="Click">';
        const result = sanitizeFrameHTML(html);

        expect(result).not.toContain('javascript:');
        expect(result).toContain('alt="Click"');
      });

      it('removes javascript: src with whitespace', () => {
        const html = '<img src="  javascript:alert(1)">';
        const result = sanitizeFrameHTML(html);

        expect(result).not.toContain('javascript:');
      });

      it('removes javascript: src case-insensitive', () => {
        const html = '<img src="JAVASCRIPT:alert(1)">';
        const result = sanitizeFrameHTML(html);

        expect(result).not.toContain('javascript:');
        expect(result).not.toContain('JAVASCRIPT:');
      });

      it('removes javascript: src with embedded control characters', () => {
        const html = '<img src="java&#10;script:alert(1)">';
        const result = sanitizeFrameHTML(html);

        expect(result).not.toContain('src=');
      });

      it('removes data:text/html URLs with embedded whitespace', () => {
        const html = '<video poster="data: text/html,<p>unsafe</p>"></video>';
        const result = sanitizeFrameHTML(html);

        expect(result).not.toContain('poster=');
      });

      it('removes data:text/html URLs', () => {
        const html = '<img src="data:text/html,<script>alert(1)</script>">';
        const result = sanitizeFrameHTML(html);

        expect(result).not.toContain('data:text/html');
      });

      it('removes vbscript URLs and control-character variants', () => {
        const html = '<img src="vB\tsCrIpT:msgbox(1)">';
        const result = sanitizeFrameHTML(html);

        expect(result).not.toContain('src=');
      });

      it('removes href regardless of scheme', () => {
        const html = '<a href="https://example.com">Link</a><a href="/local">Local</a>';
        const result = sanitizeFrameHTML(html);

        expect(result).not.toContain('href');
        expect(result).toContain('Link');
        expect(result).toContain('Local');
      });

      it.each(['png', 'jpeg', 'gif', 'webp', 'avif'])(
        'preserves valid base64 image/%s data URLs',
        (mime) => {
          const html = `<img src="data:image/${mime};base64,QUJDRA==" alt="preview">`;
          const result = sanitizeFrameHTML(html);

          expect(result).toContain(`src="data:image/${mime};base64,QUJDRA=="`);
        },
      );

      it.each([
        'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
        'data:text/html;base64,PGgxPkJhZDwvaDE+',
        'data:image/png,not-base64',
        'data:image/png;base64,',
        'data:image/png;base64,%%%%',
        'data: image/png;base64,QUJDRA==',
      ])('removes disallowed or malformed data URL %s', (url) => {
        const result = sanitizeFrameHTML(`<img src="${url}" alt="preview">`);

        expect(result).not.toContain('src=');
      });
    });

    describe('preserves safe content', () => {
      it('preserves regular div content', () => {
        const html = '<div class="container"><span>Hello World</span></div>';
        const result = sanitizeFrameHTML(html);

        expect(result).toContain('<div class="container">');
        expect(result).toContain('<span>Hello World</span>');
      });

      it('preserves img tags without event handlers', () => {
        const html = '<img src="image.png" alt="An image" />';
        const result = sanitizeFrameHTML(html);

        expect(result).toContain('<img');
        expect(result).toContain('src="image.png"');
        expect(result).toContain('alt="An image"');
      });

      it('preserves anchor tags but drops href entirely', () => {
        const html = '<a href="https://example.com">Link</a>';
        const result = sanitizeFrameHTML(html);

        expect(result).toContain('<a>');
        expect(result).toContain('Link');
        expect(result).not.toContain('href');
      });

      it('drops pointer-events from inline style so the overlay stays non-interactive', () => {
        const html = '<div style="color:red; pointer-events:auto; position:fixed">x</div>';
        const result = sanitizeFrameHTML(html);

        expect(result).toContain('color:red');
        expect(result).toContain('position:fixed');
        expect(result).not.toContain('pointer-events');
      });

      it('preserves data attributes except dangerous ones', () => {
        const html = '<div data-id="123" data-name="test">Content</div>';
        const result = sanitizeFrameHTML(html);

        expect(result).toContain('data-id="123"');
        expect(result).toContain('data-name="test"');
      });

      it('preserves aria attributes', () => {
        const html = '<div role="button" aria-label="Close" aria-hidden="false">X</div>';
        const result = sanitizeFrameHTML(html);

        expect(result).toContain('aria-label="Close"');
        expect(result).toContain('aria-hidden="false"');
        expect(result).toContain('role="button"');
      });

      it('preserves style attribute', () => {
        const html = '<div style="color: red; font-size: 16px;">Styled</div>';
        const result = sanitizeFrameHTML(html);

        expect(result).toContain('style="color: red; font-size: 16px;"');
      });
    });

    describe('complex cases', () => {
      it('handles nested dangerous content', () => {
        const html = `
          <div onclick="alert(1)">
            <span onmouseover="alert(2)">
              <a href="javascript:alert(3)">
                <img onerror="alert(4)" src="x" />
              </a>
            </span>
          </div>
        `;
        const result = sanitizeFrameHTML(html);

        expect(result).not.toContain('onclick');
        expect(result).not.toContain('onmouseover');
        expect(result).not.toContain('javascript:');
        expect(result).not.toContain('onerror');
      });

      it('handles mixed safe and dangerous content', () => {
        const html = `
          <div class="safe">
            <script>evil()</script>
            <p>Safe paragraph</p>
            <iframe src="evil.com"></iframe>
            <span data-id="123">Safe span</span>
          </div>
        `;
        const result = sanitizeFrameHTML(html);

        expect(result).toContain('class="safe"');
        expect(result).toContain('<p>Safe paragraph</p>');
        expect(result).toContain('data-id="123"');
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('<iframe');
      });

      it('handles empty input', () => {
        const result = sanitizeFrameHTML('');
        expect(result).toBe('');
      });

      it('handles whitespace only input', () => {
        const result = sanitizeFrameHTML('   \n\t   ');
        expect(result.trim()).toBe('');
      });

      it('handles plain text without HTML', () => {
        const result = sanitizeFrameHTML('Just plain text');
        expect(result).toBe('Just plain text');
      });
    });
  });

  describe('edge cases', () => {
    it('handles malformed HTML gracefully', () => {
      const malformed = '<div><span>Unclosed';
      const result = sanitizeFrameHTML(malformed);

      // DOMParser handles malformed HTML by auto-closing tags
      expect(result).toContain('Unclosed');
    });

    it('handles HTML entities safely', () => {
      const html = '<div>&lt;script&gt;alert(1)&lt;/script&gt;</div>';
      const result = sanitizeFrameHTML(html);

      // The text content should be preserved as safe text, not executed as script
      // Either as entities or decoded text - both are safe
      expect(result).toContain('alert(1)');
      expect(result).toContain('<div>');
    });

    it('handles SVG elements', () => {
      const html = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>';
      const result = sanitizeFrameHTML(html);

      // SVG structure should be preserved (no dangerous attributes)
      expect(result).toContain('svg');
    });

    it('handles deeply nested structures', () => {
      const html =
        '<div><div><div><div><div><span onclick="x">Deep</span></div></div></div></div></div>';
      const result = sanitizeFrameHTML(html);

      expect(result).not.toContain('onclick');
      expect(result).toContain('Deep');
    });

    it('handles multiple script tags', () => {
      const html = `
        <script>first()</script>
        <div>Content</div>
        <script>second()</script>
        <script type="text/javascript">third()</script>
      `;
      const result = sanitizeFrameHTML(html);

      expect(result).not.toContain('<script');
      expect(result).not.toContain('first()');
      expect(result).not.toContain('second()');
      expect(result).not.toContain('third()');
      expect(result).toContain('Content');
    });

    it('handles base64 data URLs (non-html)', () => {
      // Safe data URL (image)
      const html = '<img src="data:image/png;base64,iVBORw0KGgo=" />';
      const result = sanitizeFrameHTML(html);

      // Image data URLs are safe
      expect(result).toContain('data:image/png');
    });

    it('handles textarea with dangerous content as text', () => {
      const html = '<textarea><script>alert(1)</script></textarea>';
      const result = sanitizeFrameHTML(html);

      expect(result).toContain('<textarea');
      expect(result).toContain('&lt;script&gt;');
      expect(result).not.toContain('<script');
    });
  });
});
