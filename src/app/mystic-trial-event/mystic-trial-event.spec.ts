import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MysticTrialEventComponent } from './mystic-trial-event';

describe('MysticTrialEventComponent', () => {
  let component: MysticTrialEventComponent;
  let fixture: ComponentFixture<MysticTrialEventComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MysticTrialEventComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(MysticTrialEventComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
