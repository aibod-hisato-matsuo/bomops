/**
 * ログインフローのユニットテスト
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from './AuthContext'
import { LoginPage } from './LoginPage'

const { mockPost, mockTokenStore } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockTokenStore: {
    getAccess: vi.fn(() => null),
    getRefresh: vi.fn(() => null),
    set: vi.fn(),
    clear: vi.fn(),
  },
}))

vi.mock('../api/client', () => ({
  apiClient: { post: mockPost },
  tokenStore: mockTokenStore,
}))

function renderLogin() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/workspace" element={<p>ワークスペース到達</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LoginPage', () => {
  it('未入力で送信するとバリデーションエラーを表示する', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(
      await screen.findByText('ユーザー名を入力してください'),
    ).toBeInTheDocument()
    expect(screen.getByText('パスワードを入力してください')).toBeInTheDocument()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('正しい認証情報でトークンを保存しワークスペースへ遷移する', async () => {
    const user = userEvent.setup()
    mockPost.mockResolvedValue({ data: { access: 'acc', refresh: 'ref' } })
    renderLogin()

    await user.type(screen.getByLabelText('ユーザー名'), 'devadmin')
    await user.type(screen.getByLabelText('パスワード'), 'devpass123')
    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    await waitFor(() => {
      expect(screen.getByText('ワークスペース到達')).toBeInTheDocument()
    })
    expect(mockPost).toHaveBeenCalledWith('/auth/token/', {
      username: 'devadmin',
      password: 'devpass123',
    })
    expect(mockTokenStore.set).toHaveBeenCalledWith('acc', 'ref')
  })

  it('認証失敗(401)でエラーメッセージを表示する', async () => {
    const user = userEvent.setup()
    const error = new AxiosError('Unauthorized')
    error.response = {
      status: 401,
      statusText: '',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {},
    }
    mockPost.mockRejectedValue(error)
    renderLogin()

    await user.type(screen.getByLabelText('ユーザー名'), 'devadmin')
    await user.type(screen.getByLabelText('パスワード'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(
      await screen.findByText('ユーザー名またはパスワードが正しくありません'),
    ).toBeInTheDocument()
    expect(mockTokenStore.set).not.toHaveBeenCalled()
  })
})
