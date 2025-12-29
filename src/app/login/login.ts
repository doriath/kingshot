import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
    selector: 'app-login',
    imports: [ReactiveFormsModule],
    templateUrl: './login.html',
    styleUrl: './login.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
    private authService = inject(AuthService);
    private router = inject(Router);

    emailControl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] });
    passwordControl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] });

    loading = signal(false);
    error = signal<string | null>(null);

    async signIn(event: Event) {
        event.preventDefault();
        if (this.emailControl.invalid || this.passwordControl.invalid) return;

        this.loading.set(true);
        this.error.set(null);

        try {
            await this.authService.signInWithEmailAndPassword(
                this.emailControl.value,
                this.passwordControl.value
            );
            this.router.navigate(['/home']);
        } catch (err: any) {
            this.error.set(this.getErrorMessage(err));
        } finally {
            this.loading.set(false);
        }
    }

    async createAccount() {
        if (this.emailControl.invalid || this.passwordControl.invalid) {
            this.error.set('Please provide a valid email and password (min 6 chars)');
            return;
        }

        this.loading.set(true);
        this.error.set(null);

        try {
            await this.authService.createUserWithEmailAndPassword(
                this.emailControl.value,
                this.passwordControl.value
            );
            this.router.navigate(['/home']);
        } catch (err: any) {
            this.error.set(this.getErrorMessage(err));
        } finally {
            this.loading.set(false);
        }
    }

    async signInWithGoogle() {
        this.loading.set(true);
        this.error.set(null);
        try {
            await this.authService.signInWithGoogle();
            this.router.navigate(['/home']);
        } catch (err: any) {
            this.error.set(this.getErrorMessage(err));
        } finally {
            this.loading.set(false);
        }
    }

    private getErrorMessage(err: any): string {
        if (err.code === 'auth/invalid-credential') {
            return 'Invalid email or password.';
        }
        if (err.code === 'auth/email-already-in-use') {
            return 'Email is already in use.';
        }
        if (err.code === 'auth/weak-password') {
            return 'Password should be at least 6 characters.';
        }
        return err.message || 'An error occurred during sign in.';
    }
}
