import { TestBed } from '@angular/core/testing';

import { Scs } from './scs';

describe('Scs', () => {
  let service: Scs;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Scs);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
