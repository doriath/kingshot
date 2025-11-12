import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BearFormationOptimizer } from './bear-formation-optimizer';

describe('BearFormationOptimizer', () => {
  let component: BearFormationOptimizer;
  let fixture: ComponentFixture<BearFormationOptimizer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BearFormationOptimizer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BearFormationOptimizer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
