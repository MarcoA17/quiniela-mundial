import { TestBed } from '@angular/core/testing';

import { Quiniela } from './quiniela';

describe('Quiniela', () => {
  let service: Quiniela;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Quiniela);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
