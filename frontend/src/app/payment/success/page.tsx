"use client";

/* Paystack redirects here with ?trxref=...&reference=... after checkout.
   We wait for auth to hydrate, then verify the reference against the API
   (the backend finds the ticket by reference - no event id needed) and show
   the success receipt from the design system. */

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import Button from "@/components/Button";
import { apiVerifyPayment, type Ticket as TicketType } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";

function fmtWhen(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const toast = useToast();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [ticket, setTicket] = useState<TicketType | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const verifying = useRef(false);

  const reference = searchParams.get("reference") ?? searchParams.get("trxref");

  const verify = useCallback(() => {
    if (!reference || verifying.current) return;
    verifying.current = true;
    setStatus("loading");
    apiVerifyPayment(reference)
      .then(res => {
        // "Already processed" responses wrap the ticket
        const t = (res.ticket ?? res) as TicketType;
        setTicket(t);
        setStatus("success");
        localStorage.removeItem("ev_pending_event");
        toast({
          tone: "success",
          title: "Payment successful",
          message: "Your QR pass was emailed to you.",
        });
      })
      .catch(e => {
        setErrMsg(e instanceof Error ? e.message : "Payment verification failed");
        setStatus("error");
      })
      .finally(() => {
        verifying.current = false;
      });
  }, [reference, toast]);

  useEffect(() => {
    // Wait until auth has hydrated; verifying before the token is restored
    // produced a false "something went wrong" on every redirect.
    if (isLoading) return;
    if (!reference) {
      setStatus("error");
      setErrMsg("Missing payment reference. Please check your tickets page.");
      return;
    }
    if (!user) {
      router.push("/auth/login");
      return;
    }
    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user, reference]);

  const event = ticket?.events;

  return (
    <div
      style={{
        minHeight: "calc(100dvh - 60px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-6) var(--space-4)",
        background: "var(--bg-page)",
      }}
    >
      {status === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)" }}>
          <div style={{ width: 48, height: 48, border: "3px solid var(--border)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "ev-spin 0.8s linear infinite" }} />
          <p style={{ color: "var(--text-muted)" }}>Confirming your payment...</p>
        </div>
      )}

      {status === "error" && (
        <div className="ck-receipt" style={{ textAlign: "center" }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: "50%", margin: "0 auto 14px",
              background: "var(--danger-bg)", border: "2px solid var(--danger-bd)",
              display: "grid", placeItems: "center", color: "var(--danger)",
            }}
          >
            <Icon name="exclamation-triangle" size={24} />
          </div>
          <h1 className="t-h3" style={{ marginBottom: 6 }}>We couldn&apos;t confirm that yet</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)", marginBottom: "var(--space-5)" }}>{errMsg}</p>
          <div className="ck-receipt__actions">
            {reference && (
              <Button onClick={verify}>
                <Icon name="arrow-trending-up" size={15} /> Try again
              </Button>
            )}
            <Link href="/tickets">
              <Button variant="secondary">
                <Icon name="arrow-left" size={15} /> My tickets
              </Button>
            </Link>
          </div>
        </div>
      )}

      {status === "success" && ticket && (
        <div className="ck-receipt">
          <div className="ck-receipt__top">
            <div className="ck-receipt__chk"><Icon name="check" size={26} /></div>
            <h3>You&apos;re going! <span className="t-accent">See you there</span></h3>
            <p>
              {event?.title ? `1 ticket to ${event.title}. ` : ""}We emailed your QR pass.
            </p>
          </div>

          <div className="ck-stub">
            <div className="ck-stub__info">
              <span className="ea-eyebrow"><i />Admit 1</span>
              <strong>{event?.title ?? "Your event"}</strong>
              {event?.starts_at && <span className="ck-stub__meta">{fmtWhen(event.starts_at)}</span>}
              {event?.location && <span className="ck-stub__meta">{event.location}</span>}
              <span className="ck-stub__code">{ticket.id}</span>
            </div>
            <div className="ck-stub__perf" aria-hidden="true" />
            <div className="ck-stub__qr">
              {ticket.qr_code ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ticket.qr_code} alt="Ticket QR code" />
              ) : (
                <Icon name="qr-code" size={64} style={{ color: "var(--ink)" }} />
              )}
              <span>Scan at the gate</span>
            </div>
          </div>

          {ticket.paystack_reference && (
            <p className="ck-paystack" style={{ marginBottom: "var(--space-4)" }}>
              Ref: <b>{ticket.paystack_reference}</b>
            </p>
          )}

          <div className="ck-receipt__actions">
            <Link href="/dashboard">
              <Button variant="warm">
                <Icon name="ticket" size={16} /> My dashboard
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost">Done</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "calc(100dvh - 60px)" }}>
          <div style={{ width: 40, height: 40, border: "3px solid var(--border)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "ev-spin 0.8s linear infinite" }} />
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
