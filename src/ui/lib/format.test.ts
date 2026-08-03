import { describe, it, expect } from 'vitest';
import {
  formatForce,
  formatPower,
  formatEnergy,
  formatMass,
  formatVolume,
  formatRuntime,
  formatDuration,
  formatTwr,
  formatPercent,
  formatCount,
  formatGravity,
  formatMeters,
} from './format';

describe('formatForce', () => {
  it('scales Newtons to kN / MN / GN', () => {
    expect(formatForce(500)).toBe('500 N');
    expect(formatForce(14_400)).toBe('14.4 kN');
    expect(formatForce(4_320_000)).toBe('4.32 MN');
    expect(formatForce(7_200_000_000)).toBe('7.2 GN');
  });
  it('renders Infinity as ∞', () => {
    expect(formatForce(Infinity)).toBe('∞');
  });
});

describe('formatPower', () => {
  it('scales Watts to kW / MW / GW', () => {
    expect(formatPower(200)).toBe('200 W');
    expect(formatPower(200_000)).toBe('200 kW');
    expect(formatPower(33_600_000)).toBe('33.6 MW');
    expect(formatPower(300_000_000)).toBe('300 MW');
  });
});

describe('formatEnergy', () => {
  it('scales Wh to kWh / MWh', () => {
    expect(formatEnergy(500)).toBe('500 Wh');
    expect(formatEnergy(1_000_000)).toBe('1 MWh');
    expect(formatEnergy(3_000_000)).toBe('3 MWh');
  });
});

describe('formatMass', () => {
  it('scales kg to tonnes and kilotonnes', () => {
    expect(formatMass(508)).toBe('508 kg');
    expect(formatMass(43_200)).toBe('43.2 t');
    expect(formatMass(2_000_000)).toBe('2 kt');
  });
});

describe('formatVolume', () => {
  it('scales liters to kL / ML', () => {
    expect(formatVolume(125)).toBe('125 L');
    expect(formatVolume(15_625)).toBe('15.6 kL');
    expect(formatVolume(421_000)).toBe('421 kL');
    expect(formatVolume(2_000_000)).toBe('2 ML');
  });
});

describe('formatRuntime', () => {
  it('renders Infinity as "sustained"', () => {
    expect(formatRuntime(Infinity)).toBe('sustained');
  });
  it('renders zero as "none"', () => {
    expect(formatRuntime(0)).toBe('none');
  });
  it('renders hours, minutes, and seconds sensibly', () => {
    expect(formatRuntime(2.5)).toBe('2.5 h');
    // 0.057 h ≈ 3.4 min (the spec's worked example)
    expect(formatRuntime(0.057)).toBe('3.4 min');
    expect(formatRuntime(0.005)).toBe('18 s');
  });
});

describe('formatDuration', () => {
  it('renders Infinity as "unlimited"', () => {
    expect(formatDuration(Infinity)).toBe('unlimited');
  });
  it('renders zero as "none"', () => {
    expect(formatDuration(0)).toBe('none');
  });
  it('renders hours + minutes ("1h 42m")', () => {
    expect(formatDuration(6120)).toBe('1h 42m'); // 1 h 42 min
  });
  it('drops the trailing 0m for whole hours', () => {
    expect(formatDuration(7200)).toBe('2h');
  });
  it('renders minutes below an hour', () => {
    expect(formatDuration(204)).toBe('3.4 min');
  });
  it('renders seconds below a minute', () => {
    expect(formatDuration(42)).toBe('42 s');
  });
});

describe('formatTwr', () => {
  it('formats a ratio with a × suffix', () => {
    expect(formatTwr(2.31)).toBe('2.31×');
    expect(formatTwr(0.8)).toBe('0.8×');
  });
  it('renders Infinity (0 g) as an em dash', () => {
    expect(formatTwr(Infinity)).toBe('—');
  });
});

describe('formatPercent / formatCount / formatGravity', () => {
  it('formats a fraction as a percentage', () => {
    expect(formatPercent(0.5)).toBe('50%');
    expect(formatPercent(0.333, 1)).toBe('33.3%');
  });
  it('formats counts and Infinity', () => {
    expect(formatCount(1234)).toBe('1,234');
    expect(formatCount(Infinity)).toBe('∞');
  });
  it('formats gravity in m/s² and g', () => {
    expect(formatGravity(0)).toBe('0 (zero-g)');
    expect(formatGravity(9.81)).toBe('9.81 m/s² (1 g)');
  });
});

describe('formatMeters', () => {
  it('renders Infinity as ∞', () => {
    expect(formatMeters(Infinity)).toBe('∞');
  });
  it('keeps two decimals for small distances', () => {
    expect(formatMeters(4.909)).toBe('4.91 m');
    expect(formatMeters(0.5)).toBe('0.5 m');
  });
  it('uses one decimal in the tens of meters', () => {
    expect(formatMeters(42.55)).toBe('42.6 m');
  });
  it('drops decimals in the hundreds of meters', () => {
    expect(formatMeters(640.4)).toBe('640 m');
  });
  it('switches to kilometers above 1000 m', () => {
    expect(formatMeters(1240)).toBe('1.24 km');
    expect(formatMeters(12_500)).toBe('12.5 km');
  });
});
