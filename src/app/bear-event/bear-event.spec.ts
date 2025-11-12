import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BearEvent } from './bear-event';

describe('BearEvent', () => {
  let component: BearEvent;
  let fixture: ComponentFixture<BearEvent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BearEvent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BearEvent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
