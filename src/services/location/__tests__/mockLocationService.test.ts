import { MockLocationService } from '../mockLocationService';

describe('MockLocationService Contract', () => {
  let service: MockLocationService;

  beforeEach(() => {
    service = new MockLocationService();
  });

  afterEach(async () => {
    await service.stopTracking();
  });

  it('reports granted permissions by default', async () => {
    const status = await service.getPermissionStatus();
    expect(status).toBe('granted');
  });

  it('returns current mock location when permitted', async () => {
    const loc = await service.getCurrentLocation();
    expect(loc).not.toBeNull();
    expect(loc?.latitude).toBe(37.7749);
    expect(loc?.longitude).toBe(-122.4194);
  });

  it('returns null if permission is denied', async () => {
    service.setPermissionStatus('denied');
    const loc = await service.getCurrentLocation();
    expect(loc).toBeNull();
  });

  it('calls onLocation during active tracking and cancels on stopTracking', async () => {
    jest.useFakeTimers();
    const onLocation = jest.fn();
    const onError = jest.fn();

    const unsubscribe = await service.startTracking(
      { timeIntervalMs: 500 },
      onLocation,
      onError
    );

    jest.advanceTimersByTime(1100);
    expect(onLocation).toHaveBeenCalledTimes(2);

    unsubscribe();
    jest.advanceTimersByTime(1000);
    expect(onLocation).toHaveBeenCalledTimes(2); // No further calls after unsubscribe
    jest.useRealTimers();
  });
});
