import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WeatherDashboard } from './weather-dashboard';

describe('WeatherDashboard', () => {
  let component: WeatherDashboard;
  let fixture: ComponentFixture<WeatherDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeatherDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WeatherDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
