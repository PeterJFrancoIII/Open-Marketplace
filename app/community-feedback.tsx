"use client";

import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import {
  buildSurfaceHref,
  slugSurfaceId,
  type CommunityReportKind,
} from "../lib/community-reports";

type SurfaceTarget = {
  surfaceId: string;
  surfaceLabel: string;
  surfaceHref: string;
  pagePath: string;
};

const SURFACE_SELECTOR = [
  "button:not([data-feedback-bang])",
  "a[href]:not([data-feedback-bang])",
  "[role='button']:not([data-feedback-bang])",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "label",
  "section",
  "article",
  "header",
  "nav",
  "main",
  "aside",
  "form",
  "[data-feedback-surface]",
].join(",");

const overlayBangs = new Map<HTMLElement, HTMLButtonElement>();

function pagePathFromLocation() {
  return `${window.location.pathname}${window.location.search}` || "/";
}

function surfaceLabelFor(element: Element) {
  if (!(element instanceof HTMLElement)) return element.tagName.toLowerCase();
  const labeled =
    element.getAttribute("aria-label") ||
    element.getAttribute("data-feedback-surface") ||
    element.getAttribute("name") ||
    element.getAttribute("placeholder") ||
    element.id ||
    element.textContent;
  const compact = (labeled || element.tagName).replace(/\s+/g, " ").trim();
  return compact.slice(0, 80) || element.tagName.toLowerCase();
}

function surfaceIdFor(element: Element) {
  if (element instanceof HTMLElement && element.dataset.feedbackSurface) {
    return slugSurfaceId([element.dataset.feedbackSurface]);
  }
  if (element.id) return slugSurfaceId([element.id]);
  return slugSurfaceId([
    window.location.pathname.replace(/^\//, "") || "home",
    surfaceLabelFor(element),
    element.tagName.toLowerCase(),
  ]);
}

function isSkippable(element: Element) {
  if (!(element instanceof HTMLElement)) return true;
  if (element.closest("[data-feedback-ignore]")) return true;
  if (element.dataset.feedbackBang) return true;
  if (element.classList.contains("feedback-bang")) return true;
  return false;
}

function isSurfaceVisible(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) return false;
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function shouldSkipNestedField(element: HTMLElement) {
  if (
    !(
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement
    )
  ) {
    return false;
  }
  const label = element.closest("label");
  return Boolean(label && label !== element && !isSkippable(label));
}

function bangHost() {
  return document.getElementById("community-feedback-bangs");
}

function positionOverlayBang(element: HTMLElement, bang: HTMLButtonElement) {
  const rect = element.getBoundingClientRect();
  bang.hidden = !isSurfaceVisible(element);
  bang.style.left = `${Math.max(4, rect.right - 20)}px`;
  bang.style.top = `${Math.max(4, rect.top + 2)}px`;
}

function targetFrom(element: Element): SurfaceTarget {
  const surfaceId = surfaceIdFor(element);
  const pagePath = pagePathFromLocation().split("#")[0] || "/";
  return {
    surfaceId,
    surfaceLabel: surfaceLabelFor(element),
    surfaceHref: buildSurfaceHref(pagePath, surfaceId),
    pagePath: pagePath.split("?")[0] || "/",
  };
}

function attachBang(element: Element) {
  if (!(element instanceof HTMLElement) || isSkippable(element)) return;
  if (shouldSkipNestedField(element)) return;
  const host = bangHost();
  if (!host) return;
  const existing = overlayBangs.get(element);
  if (existing?.isConnected) {
    element.dataset.feedbackMarked = "1";
    positionOverlayBang(element, existing);
    return;
  }
  const target = targetFrom(element);
  const bang = document.createElement("button");
  bang.type = "button";
  bang.className = "feedback-bang feedback-bang-overlay";
  bang.dataset.feedbackBang = "1";
  bang.dataset.feedbackIgnore = "1";
  bang.textContent = "!";
  bang.setAttribute(
    "aria-label",
    `Report a bug or request a feature for ${target.surfaceLabel}`,
  );
  bang.title = `Report ${target.surfaceLabel}`;
  bang.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.dispatchEvent(
      new CustomEvent("open-marketplace:community-report", { detail: target }),
    );
  });
  host.appendChild(bang);
  overlayBangs.set(element, bang);
  element.dataset.feedbackMarked = "1";
  positionOverlayBang(element, bang);
}

function pruneOverlayBangs(root: ParentNode) {
  for (const [element, bang] of overlayBangs) {
    if (
      !element.isConnected ||
      !(root instanceof Element ? root.contains(element) : document.contains(element)) ||
      isSkippable(element) ||
      shouldSkipNestedField(element)
    ) {
      bang.remove();
      overlayBangs.delete(element);
      delete element.dataset.feedbackMarked;
    }
  }
}

function markDocumentSurfaces(root: ParentNode) {
  pruneOverlayBangs(root);
  root.querySelectorAll(SURFACE_SELECTOR).forEach(attachBang);
  for (const [element, bang] of overlayBangs) {
    positionOverlayBang(element, bang);
  }
}

export default function CommunityFeedbackRoot({
  children,
}: {
  children: ReactNode;
}) {
  const titleId = useId();
  const [target, setTarget] = useState<SurfaceTarget | null>(null);
  const [kind, setKind] = useState<CommunityReportKind>("bug");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    setTarget(null);
    setKind("bug");
    setTitle("");
    setDetails("");
    setBusy(false);
    setNotice(null);
    setError(null);
  }, []);

  useEffect(() => {
    const root = document.getElementById("community-feedback-root");
    if (!root) return;
    let frame = 0;
    const refresh = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => markDocumentSurfaces(root));
    };
    markDocumentSurfaces(root);
    const observer = new MutationObserver(refresh);
    observer.observe(root, { childList: true, subtree: true });
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<SurfaceTarget>).detail;
      if (!detail?.surfaceId) return;
      setTarget(detail);
      setKind("bug");
      setTitle("");
      setDetails("");
      setNotice(null);
      setError(null);
    };
    window.addEventListener("open-marketplace:community-report", onOpen);
    window.addEventListener("scroll", refresh, true);
    window.addEventListener("resize", refresh);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("open-marketplace:community-report", onOpen);
      window.removeEventListener("scroll", refresh, true);
      window.removeEventListener("resize", refresh);
      for (const [element, bang] of overlayBangs) {
        bang.remove();
        overlayBangs.delete(element);
        delete element.dataset.feedbackMarked;
      }
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const surface = params.get("surface");
    if (!surface) return;
    const marked = document.querySelector(`[data-feedback-marked="1"]`);
    const match =
      [...document.querySelectorAll("[data-feedback-marked='1']")].find((element) => {
        return surfaceIdFor(element) === slugSurfaceId([surface]);
      }) ?? marked;
    if (match instanceof HTMLElement) {
      match.classList.add("feedback-surface-focus");
      match.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/community-reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          title,
          details,
          ...target,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        setError(payload.error || "The report could not be saved.");
        return;
      }
      setNotice(payload.message || "Saved. Thank you for testing this surface.");
    } catch {
      setError("The report could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="community-feedback-root" className="community-feedback-root">
      {children}
      <div
        id="community-feedback-bangs"
        className="community-feedback-bangs"
        data-feedback-ignore="1"
      />
      {target ? (
        <div
          className="feedback-modal-backdrop"
          data-feedback-ignore="1"
          role="presentation"
          onClick={close}
        >
          <div
            className="feedback-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="feedback-modal-eyebrow">Community report</p>
            <h2 id={titleId}>What should change on this surface?</h2>
            <p className="feedback-modal-lead">
              Testers report every page, button, and section. The selected
              control’s link is included automatically. Security and
              access-control changes are reviewed only by administrators.
            </p>
            <p className="feedback-modal-surface">
              <span>Surface</span>
              <a href={target.surfaceHref}>{target.surfaceLabel}</a>
              <code>{target.surfaceHref}</code>
            </p>
            {notice ? (
              <div className="feedback-modal-result">
                <p>{notice}</p>
                <button className="button button-primary" type="button" onClick={close}>
                  Close
                </button>
              </div>
            ) : (
              <form className="feedback-modal-form" onSubmit={submit}>
                <fieldset>
                  <legend>Report type</legend>
                  <label>
                    <input
                      checked={kind === "bug"}
                      name="community-report-kind"
                      onChange={() => setKind("bug")}
                      type="radio"
                      value="bug"
                    />
                    Bug
                  </label>
                  <label>
                    <input
                      checked={kind === "feature"}
                      name="community-report-kind"
                      onChange={() => setKind("feature")}
                      type="radio"
                      value="feature"
                    />
                    Feature request
                  </label>
                </fieldset>
                <label>
                  Short summary
                  <input
                    maxLength={120}
                    minLength={8}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                    value={title}
                  />
                </label>
                <label>
                  Details
                  <textarea
                    maxLength={2000}
                    minLength={1}
                    onChange={(event) => setDetails(event.target.value)}
                    required
                    rows={5}
                    value={details}
                  />
                </label>
                {error ? <p className="feedback-modal-error">{error}</p> : null}
                <div className="feedback-modal-actions">
                  <button className="button button-ghost" onClick={close} type="button">
                    Cancel
                  </button>
                  <button className="button button-primary" disabled={busy} type="submit">
                    {busy ? "Saving…" : "Send report"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
