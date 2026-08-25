"use client";

import { useEffect } from "react";

/**
 * AdaWidgetInjector — loads the platform owner's ADA widget after hydration.
 *
 * Third-party accessibility widgets can mutate the DOM as soon as their script
 * executes. Running that code during SSR/hydration can make React's server HTML
 * differ from the browser DOM and trigger hydration error #418.
 *
 * Keep the server/client markup identical (an empty container), then execute the
 * saved embed code from useEffect after React has hydrated the page.
 */

interface Props {
  code: string;
}

function appendExecutableNode(target: Node, source: Node): void {
  if (source.nodeType === Node.TEXT_NODE) {
    target.appendChild(document.createTextNode(source.textContent ?? ""));
    return;
  }

  if (source.nodeType === Node.COMMENT_NODE) {
    target.appendChild(document.createComment(source.textContent ?? ""));
    return;
  }

  if (!(source instanceof Element)) return;

  if (source.tagName.toLowerCase() === "script") {
    const script = document.createElement("script");
    for (const attribute of Array.from(source.attributes)) {
      script.setAttribute(attribute.name, attribute.value);
    }
    script.textContent = source.textContent ?? "";
    target.appendChild(script);
    return;
  }

  const element = document.createElement(source.tagName.toLowerCase());
  for (const attribute of Array.from(source.attributes)) {
    element.setAttribute(attribute.name, attribute.value);
  }
  for (const child of Array.from(source.childNodes)) {
    appendExecutableNode(element, child);
  }
  target.appendChild(element);
}

export default function AdaWidgetInjector({ code }: Props) {
  useEffect(() => {
    const container = document.getElementById("ada-widget-container");
    if (!container || !code.trim()) return;

    container.replaceChildren();

    const template = document.createElement("template");
    template.innerHTML = code;

    for (const child of Array.from(template.content.childNodes)) {
      appendExecutableNode(container, child);
    }

    return () => {
      container.replaceChildren();
    };
  }, [code]);

  return <div id="ada-widget-container" aria-hidden="true" />;
}
