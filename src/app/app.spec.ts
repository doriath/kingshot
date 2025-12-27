import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { UserDataService } from './user-data.service';
import { SolverService } from './solver.service';
import { of } from 'rxjs';
import { signal } from '@angular/core';

describe('App', () => {
  beforeEach(async () => {
    const authServiceMock = {
      user$: of(null)
    };

    const userDataServiceMock = {
      characters: signal([])
    };

    const solverServiceMock = {
      isSolverLoaded: () => false,
      solve: async () => { }
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
        { provide: UserDataService, useValue: userDataServiceMock },
        { provide: SolverService, useValue: solverServiceMock }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Kingshot Companion');
  });
});
