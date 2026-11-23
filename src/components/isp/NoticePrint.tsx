'use client';
import { fmtDate, money } from '@/lib/format';
import { NOTICE_LABEL } from './data';
import type { Notice } from '@/lib/types';

export default function NoticePrint({ notices }: { notices: Notice[] }) {
  return (
    <>
      {notices.map((nt, i) => (
        <div key={nt.id} className={`avoid-break border border-black p-6 mb-6 ${i < notices.length - 1 && i % 2 === 1 ? 'page-break' : ''}`}>
          <div className="text-center mb-4">
            <p className="font-bold text-base">INTERNET SERVICE PROVIDER</p>
            <p className="font-bold text-sm uppercase tracking-wide mt-1">{NOTICE_LABEL[nt.notice_type]}</p>
          </div>
          <div className="flex justify-between mb-4">
            <div>
              <p><b>{nt.isp_customers?.full_name}</b></p>
              <p>Account #: {nt.isp_customers?.account_no}</p>
              <p>{nt.isp_customers?.address ?? ''}{nt.isp_customers?.area ? `, ${nt.isp_customers.area}` : ''}</p>
            </div>
            <div className="text-right">
              <p>Date: {fmtDate(nt.issued_on)}</p>
              {nt.due_date && <p>Due: <b>{fmtDate(nt.due_date)}</b></p>}
              {Number(nt.amount_due) > 0 && <p className="text-sm font-bold">Amount due: {money(nt.amount_due)}</p>}
            </div>
          </div>
          <p className="whitespace-pre-line leading-relaxed">{nt.message}</p>
          <div className="flex justify-between mt-10 text-center">
            <div className="w-48 border-t border-black pt-1">Billing / Collection</div>
            <div className="w-48 border-t border-black pt-1">Received by / Date</div>
          </div>
        </div>
      ))}
    </>
  );
}

export function fillTemplate(tpl: string, v: { name: string; account: string; amount: number; due: string | null }) {
  return tpl
    .replaceAll('{name}', v.name)
    .replaceAll('{account}', v.account)
    .replaceAll('{amount}', money(v.amount))
    .replaceAll('{due}', v.due ? fmtDate(v.due) : 'the due date');
}
