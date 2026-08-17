import { EventEmitter } from 'node:events';

/** Global pub/sub for run/incident/heal/alert events → SSE + logging. */
export interface HydraEvent {
  ts: string;
  type: 'run' | 'incident' | 'heal' | 'alert' | 'chaos';
  collector: string;
  payload: unknown;
}

class EventBus extends EventEmitter {
  emitEvent(evt: Omit<HydraEvent, 'ts'>) {
    const full: HydraEvent = { ts: new Date().toISOString(), ...evt };
    this.emit('event', full);
  }
}

export const bus = new EventBus();
bus.setMaxListeners(50);
