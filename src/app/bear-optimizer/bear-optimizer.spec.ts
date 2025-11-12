import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BearOptimizerComponent } from './bear-optimizer';

describe('BearOptimizerComponent', () => {
  let component: BearOptimizerComponent;
  let fixture: ComponentFixture<BearOptimizerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BearOptimizerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BearOptimizerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
