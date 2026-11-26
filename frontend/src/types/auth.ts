export interface AuthUser {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  role: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  user: AuthUser
}

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput {
  email: string
  displayName: string
  password: string
}

export interface RefreshInput {
  refreshToken: string
}

export interface LogoutInput {
  refreshToken: string
}
