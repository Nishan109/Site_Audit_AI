/** Move to the existing form without creating a second review entry point. */
export function focusReviewForm() {
  const field = document.getElementById("url-input");
  if (!field) return;
  field.focus({ preventScroll: true });
  field.scrollIntoView({
    behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
    block: "center",
  });
}
