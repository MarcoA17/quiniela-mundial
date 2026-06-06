import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Quiniela } from './quiniela';

describe('Quiniela', () => {
  let component: Quiniela;
  let fixture: ComponentFixture<Quiniela>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Quiniela],
    }).compileComponents();

    fixture = TestBed.createComponent(Quiniela);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
