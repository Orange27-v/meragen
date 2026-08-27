import { Injectable, Logger, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export interface GoogleIdentity {
  firebaseUid: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

/**
 * Verifies Google sign-ins.
 *
 * Firebase is the identity provider and nothing more: it tells us "this is
 * genuinely person X with email Y". Sessions, credits and the ledger stay ours
 * — a Google account never gains any authority over money.
 *
 * Verification is server-side on purpose. The browser hands us an ID token; if
 * we simply believed the email in it, anyone could claim any account.
 */
@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);
  private readonly app: App | null;

  constructor(private readonly config: ConfigService) {
    this.app = FirebaseService.isConfigured(config) ? this.initialise() : null;
    if (!this.app) {
      this.logger.log('Firebase not configured — Google sign-in is off, email and password still work.');
    }
  }

  static isConfigured(config: ConfigService): boolean {
    return Boolean(
      config.get<string>('FIREBASE_PROJECT_ID') &&
        config.get<string>('FIREBASE_CLIENT_EMAIL') &&
        config.get<string>('FIREBASE_PRIVATE_KEY'),
    );
  }

  get enabled(): boolean {
    return this.app !== null;
  }

  private initialise(): App {
    const existing = getApps();
    if (existing.length > 0) return existing[0];

    return initializeApp({
      credential: cert({
        projectId: this.config.get<string>('FIREBASE_PROJECT_ID'),
        clientEmail: this.config.get<string>('FIREBASE_CLIENT_EMAIL'),
        // Service-account keys carry literal "\n" when they travel through an
        // env var, which breaks PEM parsing unless we put the newlines back.
        privateKey: this.config.get<string>('FIREBASE_PRIVATE_KEY', '').replace(/\\n/g, '\n'),
      }),
    });
  }

  /** Checks an ID token's signature, issuer and expiry with Google. */
  async verifyIdToken(idToken: string): Promise<GoogleIdentity> {
    if (!this.app) {
      throw new ServiceUnavailableException('Google sign-in is not available yet.');
    }

    let decoded;
    try {
      decoded = await getAuth(this.app).verifyIdToken(idToken, true);
    } catch (error) {
      this.logger.warn(`Rejected Google token: ${(error as Error).message}`);
      throw new UnauthorizedException('That Google sign-in could not be verified. Please try again.');
    }

    if (!decoded.email) {
      throw new UnauthorizedException('That Google account has no email address on it.');
    }
    // Google's own accounts are always verified; refusing anything else keeps a
    // spoofed unverified address from claiming an existing Meerah account.
    if (!decoded.email_verified) {
      throw new UnauthorizedException('Please verify your email with Google first.');
    }

    return {
      firebaseUid: decoded.uid,
      email: decoded.email.toLowerCase(),
      emailVerified: true,
      name: typeof decoded.name === 'string' ? decoded.name : undefined,
    };
  }
}
