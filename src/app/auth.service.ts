import { Injectable, inject } from '@angular/core';
import { Auth, GoogleAuthProvider, signInWithPopup, signOut, user, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '@angular/fire/auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  public readonly user$ = user(this.auth);

  async signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(this.auth, provider);
  }

  async signInWithEmailAndPassword(email: string, pass: string) {
    return await signInWithEmailAndPassword(this.auth, email, pass);
  }

  async createUserWithEmailAndPassword(email: string, pass: string) {
    return await createUserWithEmailAndPassword(this.auth, email, pass);
  }

  async signOut() {
    await signOut(this.auth);
  }
}
