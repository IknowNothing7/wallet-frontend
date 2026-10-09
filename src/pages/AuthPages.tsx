import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router'

import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ErrorMessage } from '../components/ui'

function FieldError({ errors, name }: { errors: Record<string, string> | null; name: string }) {
  return errors?.[name] ? <span className="field-error">{errors[name]}</span> : null
}

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      // On success GuestOnly (App.tsx) redirects away from this page
      await login(email, password)
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-card">
      <h1>Log in</h1>
      <form onSubmit={submit}>
        <label>
          Email
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <ErrorMessage error={error} />
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="muted">
        No account? <Link to="/register">Register</Link>
      </p>
    </div>
  )
}

export function RegisterPage() {
  const { register } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const update = (field: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors(null)
    try {
      // On success GuestOnly (App.tsx) redirects away from this page
      await register(form.name, form.email, form.password, form.confirmPassword)
    } catch (err) {
      setError((err as Error).message)
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors)
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-card">
      <h1>Create account</h1>
      <form onSubmit={submit}>
        <label>
          Name
          <input autoComplete="name" required maxLength={100} value={form.name} onChange={update('name')} />
          <FieldError errors={fieldErrors} name="name" />
        </label>
        <label>
          Email
          <input type="email" autoComplete="email" required maxLength={100} value={form.email} onChange={update('email')} />
          <FieldError errors={fieldErrors} name="email" />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            value={form.password}
            onChange={update('password')}
          />
          <span className="hint">At least 8 characters with upper and lower case letters, a digit and a symbol.</span>
          <FieldError errors={fieldErrors} name="password" />
        </label>
        <label>
          Confirm password
          <input
            type="password"
            autoComplete="new-password"
            required
            value={form.confirmPassword}
            onChange={update('confirmPassword')}
          />
          <FieldError errors={fieldErrors} name="confirmPassword" />
        </label>
        <ErrorMessage error={error} />
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p className="muted">
        Already registered? <Link to="/login">Log in</Link>
      </p>
    </div>
  )
}
