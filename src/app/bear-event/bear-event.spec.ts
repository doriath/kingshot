import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BearEventComponent } from './bear-event';

describe('BearEventComponent', () => {
  let component: BearEventComponent;
  let fixture: ComponentFixture<BearEventComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BearEventComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(BearEventComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
