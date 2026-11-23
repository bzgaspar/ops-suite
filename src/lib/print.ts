'use client';

/** Print the page as shown (reports) instead of only <Printable> content. */
export function printPage() {
  document.body.classList.add('print-main');
  const done = () => { document.body.classList.remove('print-main'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
}
