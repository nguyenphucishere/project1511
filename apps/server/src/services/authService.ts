export interface AuthSession {
  userId: string;
  username: string;
  email: string;
}

export class AuthService {
  async validateToken(_token: string): Promise<AuthSession | null> {
    throw new Error("TODO: Implement validateToken");
  }
}
