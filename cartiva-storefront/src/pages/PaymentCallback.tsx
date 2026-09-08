import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCart } from '../context/CartContext'
import { Loading } from '../components/Loading'

type State =
  | { kind: 'verifying' }
  | { kind: 'verified'; orderId: string }
  | { kind: 'pending'; orderId: string }
  | { kind: 'failed'; orderId: string; detail: string }
  | { kind: 'error'; detail: string }

function pickReference(params: URLSearchParams): string | null {
  for (const key of ['reference', 'ref', 'session_ref', 'sessionRef', 'session', 'trxref']) {
    const v = params.get(key)
    if (v && v.trim()) return v.trim()
  }
  return null
}

export default function PaymentCallback() {
  const [params] = useSearchParams()
  const { clear } = useCart()
  const [state, setState] = useState<State>({ kind: 'verifying' })

  const orderId = params.get('order_id')
  const reference = pickReference(params)

  useEffect(() => {
    let cancelled = false
    async function verify() {
      if (!orderId || !reference) {
        if (!cancelled) setState({ kind: 'error', detail: 'Missing payment reference. If you completed payment, check your orders page — your order is saved.' })
        return
      }
      setState({ kind: 'verifying' })
      try {
        const { data, error } = await supabase.functions.invoke('seevplus-verify', {
          body: { reference, order_id: orderId },
        })
        if (cancelled) return
        if (error) {
          setState({ kind: 'error', detail: error.message })
          return
        }
        if (data?.status === 'verified' || data?.status === 'already_verified') {
          clear()
          setState({ kind: 'verified', orderId })
        } else if (data?.status === 'pending' || data?.status === 'unknown') {
          setState({ kind: 'pending', orderId })
        } else {
          setState({ kind: 'failed', orderId, detail: `Payment status: ${data?.status ?? 'unknown'}. No money was taken for a failed session — you can safely retry.` })
        }
      } catch (e) {
        if (!cancelled) setState({ kind: 'error', detail: (e as Error).message })
      }
    }
    verify()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, reference])

  return (
    <div className="page">
      <section className="section"><div className="container" style={{ maxWidth: 560 }}>
        {state.kind === 'verifying' && <Loading label="Confirming your payment..." />}

        {state.kind === 'verified' && (
          <div style={{ textAlign: 'center' }}>
            <div className="success-circle">✓</div>
            <h1 className="order-number">Payment confirmed.</h1>
            <p style={{ color: '#6B7280', fontSize: 13, marginBottom: 24 }}>Your Seev Plus payment went through. We&apos;re preparing your order.</p>
            <Link to={`/account/orders/${state.orderId}`} className="primary-btn">View your order →</Link>
          </div>
        )}

        {state.kind === 'pending' && (
          <div style={{ textAlign: 'center' }}>
            <div className="success-circle" style={{ background: '#fef3c7', color: '#b45309' }}>…</div>
            <h1 className="order-number">Payment pending.</h1>
            <p style={{ color: '#6B7280', fontSize: 13, marginBottom: 24 }}>Seev Plus hasn&apos;t confirmed it yet. This can take a few minutes — please don&apos;t pay twice.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="primary-btn" onClick={() => window.location.reload()}>Check again</button>
              <Link to={`/account/orders/${state.orderId}`} className="secondary-btn">View order</Link>
            </div>
          </div>
        )}

        {state.kind === 'failed' && (
          <div style={{ textAlign: 'center' }}>
            <div className="success-circle" style={{ background: '#fee2e2', color: 'var(--red)' }}>×</div>
            <h1 className="order-number">Payment didn&apos;t go through.</h1>
            <p style={{ color: '#6B7280', fontSize: 13, marginBottom: 24 }}>{state.detail}</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to={`/account/orders/${state.orderId}`} className="primary-btn">View order</Link>
              <Link to="/catalogue" className="secondary-btn">Continue shopping</Link>
            </div>
          </div>
        )}

        {state.kind === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div className="success-circle" style={{ background: '#fee2e2', color: 'var(--red)' }}>!</div>
            <h1 className="order-number">Couldn&apos;t confirm payment.</h1>
            <p style={{ color: '#6B7280', fontSize: 13, marginBottom: 24 }}>{state.detail}</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="primary-btn" onClick={() => window.location.reload()}>Try again</button>
              <Link to="/account/orders" className="secondary-btn">My orders</Link>
            </div>
          </div>
        )}
      </div></section>
    </div>
  )
}
