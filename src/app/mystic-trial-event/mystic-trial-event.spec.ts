import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MysticTrialEvent } from './mystic-trial-event';

describe('MysticTrialEvent', () => {
  let component: MysticTrialEvent;
  let fixture: ComponentFixture<MysticTrialEvent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MysticTrialEvent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MysticTrialEvent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
