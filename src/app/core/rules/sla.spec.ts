import { describe, expect, it } from 'vitest';
import { Message } from '../models/messages';
import {
  addBusinessDays,
  addBusinessHours,
  businessDaysBetween,
  businessMinutesBetween,
  complaintDueAt,
  isBusinessDay,
  isComplaintOverdue,
  isMessageOverdue,
  isNationalHoliday,
  messageDisplayStatus,
  messageDueAt,
  messageOverdueBusinessMinutes,
  nationalHolidays,
  nextBusinessDay,
  normalizeToBusinessTime,
  slaByChannel,
  wasAnsweredOnTime,
} from './sla';

const at = (date: string, time: string): string => `${date}T${time}:00-03:00`;

describe('Feriados e dias úteis (RN-CAN-03)', () => {
  it('feriados nacionais de 2026, com a Sexta-feira Santa calculada', () => {
    const h = nationalHolidays(2026);
    expect(h).toContain('2026-01-01');
    expect(h).toContain('2026-04-03'); // Sexta-feira Santa
    expect(h).toContain('2026-04-21');
    expect(h).toContain('2026-05-01');
    expect(h).toContain('2026-09-07');
    expect(h).toContain('2026-10-12');
    expect(h).toContain('2026-11-02');
    expect(h).toContain('2026-11-15');
    expect(h).toContain('2026-11-20');
    expect(h).toContain('2026-12-25');
    expect(nationalHolidays(2027)).toContain('2027-03-26');
  });

  it('dia útil é segunda a sexta sem feriado', () => {
    expect(isBusinessDay('2026-11-04')).toBe(true);
    expect(isBusinessDay('2026-11-07')).toBe(false);
    expect(isBusinessDay('2026-11-02')).toBe(false); // Finados
    expect(isNationalHoliday('2026-11-02')).toBe(true);
    expect(nextBusinessDay('2026-10-30')).toBe('2026-11-03'); // sexta vai a terça (segunda é feriado)
    expect(nextBusinessDay('2026-11-06')).toBe('2026-11-09');
  });

  it('soma e conta dias úteis', () => {
    expect(addBusinessDays('2026-11-04', 5)).toBe('2026-11-11');
    expect(addBusinessDays('2026-11-06', 1)).toBe('2026-11-09');
    expect(addBusinessDays('2026-10-30', 1)).toBe('2026-11-03');
    expect(businessDaysBetween('2026-11-03', '2026-11-10')).toBe(5);
    expect(businessDaysBetween('2026-11-04', '2026-11-04')).toBe(0);
  });
});

describe('Prazos de mensagens em horas úteis (RN-CAN-02; AC-M11-01, 02)', () => {
  it('o prazo por canal: app 24 h úteis, WhatsApp 4 h, telefone imediato, e-mail 48 h', () => {
    // quarta 10h
    expect(messageDueAt('whatsapp', at('2026-11-04', '10:00'))).toBe(at('2026-11-04', '14:00'));
    expect(messageDueAt('phone', at('2026-11-04', '10:00'))).toBe(at('2026-11-04', '10:00'));
    expect(messageDueAt('app', at('2026-11-04', '10:00'))).toBe(at('2026-11-06', '14:00'));
    expect(messageDueAt('email', at('2026-11-04', '10:00'))).toBe(at('2026-11-10', '18:00'));
  });

  it('e-mail: 48 horas úteis são 4 dias de 10 horas e mais 8', () => {
    // quarta 08h + 48 h úteis = 4 dias úteis completos (qua, qui, sex, seg = 40 h) e mais 8 h na terça
    expect(messageDueAt('email', at('2026-11-04', '08:00'))).toBe(at('2026-11-10', '16:00'));
  });

  it('WhatsApp recebido fora do horário começa a contar na abertura seguinte', () => {
    expect(messageDueAt('whatsapp', at('2026-11-04', '19:00'))).toBe(at('2026-11-05', '12:00'));
    expect(messageDueAt('whatsapp', at('2026-11-07', '11:00'))).toBe(at('2026-11-09', '12:00')); // sábado
    expect(messageDueAt('whatsapp', at('2026-11-04', '06:30'))).toBe(at('2026-11-04', '12:00'));
  });

  it('WhatsApp de sexta 17h30: 30 min na sexta e 3h30 na segunda (conta minuto a minuto)', () => {
    // Nota: o AC-M11-02 diz "até 12h de segunda"; a regra RN-CAN-03 em minutos dá 11h30 (ver docs/08-arquitetura.md).
    expect(messageDueAt('whatsapp', at('2026-11-06', '17:30'))).toBe(at('2026-11-09', '11:30'));
    expect(normalizeToBusinessTime(at('2026-11-06', '18:00'))).toBe(at('2026-11-09', '08:00'));
  });

  it('feriado no meio do prazo é pulado', () => {
    // sexta 30/10 16h + 4 h úteis: 2 h na sexta, segunda 02/11 é feriado, 2 h na terça 03/11
    expect(addBusinessHours(at('2026-10-30', '16:00'), 4)).toBe(at('2026-11-03', '10:00'));
  });

  it('minutos úteis entre dois instantes (atraso em horas úteis)', () => {
    expect(businessMinutesBetween(at('2026-11-04', '14:00'), at('2026-11-04', '16:30'))).toBe(150);
    expect(businessMinutesBetween(at('2026-11-04', '16:00'), at('2026-11-05', '09:00'))).toBe(180); // 2 h + 1 h
    expect(businessMinutesBetween(at('2026-11-06', '17:00'), at('2026-11-09', '09:00'))).toBe(120);
    expect(businessMinutesBetween(at('2026-11-04', '16:00'), at('2026-11-04', '15:00'))).toBe(0);
  });
});

describe('Mensagens atrasadas e SLA por canal (K30, RN-CAN-04)', () => {
  const msg = (partial: Partial<Message>): Message =>
    ({
      id: 'm',
      createdAt: '',
      updatedAt: '',
      channel: 'whatsapp',
      direction: 'in',
      body: '',
      receivedAt: at('2026-11-04', '08:00'),
      dueAt: at('2026-11-04', '12:00'),
      status: 'new',
      isSupportRequest: false,
      ...partial,
    }) as Message;

  it('overdue é derivado: não respondida e depois do prazo', () => {
    const m = msg({});
    expect(isMessageOverdue(m, at('2026-11-04', '11:59'))).toBe(false);
    expect(isMessageOverdue(m, at('2026-11-04', '12:00'))).toBe(false);
    expect(isMessageOverdue(m, at('2026-11-04', '12:01'))).toBe(true);
    expect(isMessageOverdue({ ...m, status: 'answered' }, at('2026-11-05', '12:01'))).toBe(false);
    expect(messageDisplayStatus(m, at('2026-11-04', '15:00'))).toBe('overdue');
    expect(messageDisplayStatus({ ...m, status: 'in_progress' }, at('2026-11-04', '10:00'))).toBe(
      'in_progress',
    );
  });

  it('o atraso é medido em horas úteis (WhatsApp há 6 horas úteis sem resposta)', () => {
    const m = msg({ receivedAt: at('2026-11-03', '08:00'), dueAt: at('2026-11-03', '12:00') });
    expect(messageOverdueBusinessMinutes(m, at('2026-11-04', '08:00'))).toBe(360);
    expect(messageOverdueBusinessMinutes(m, at('2026-11-03', '10:00'))).toBe(0);
  });

  it('SLA por canal: respondidas no prazo ÷ consideradas (respondidas ou vencidas)', () => {
    const list = [
      msg({
        channel: 'whatsapp',
        status: 'answered',
        dueAt: at('2026-11-03', '12:00'),
        firstResponseAt: at('2026-11-03', '11:00'),
      }),
      msg({
        channel: 'whatsapp',
        status: 'answered',
        dueAt: at('2026-11-03', '12:00'),
        firstResponseAt: at('2026-11-03', '13:00'),
      }),
      msg({ channel: 'whatsapp', status: 'new', dueAt: at('2026-11-03', '12:00') }),
      msg({ channel: 'whatsapp', status: 'new', dueAt: at('2026-11-30', '12:00') }), // ainda no prazo: fora da conta
      msg({
        channel: 'app',
        status: 'answered',
        dueAt: at('2026-11-03', '12:00'),
        firstResponseAt: at('2026-11-03', '12:00'),
      }),
    ];
    const stats = slaByChannel(list, at('2026-11-04', '12:00'));
    expect(stats.find((s) => s.channel === 'whatsapp')).toMatchObject({
      considered: 3,
      onTime: 1,
      percent: 33.3,
    });
    expect(stats.find((s) => s.channel === 'app')).toMatchObject({
      considered: 1,
      onTime: 1,
      percent: 100,
    });
    expect(stats.find((s) => s.channel === 'phone')).toMatchObject({
      considered: 0,
      percent: null,
    });
    expect(wasAnsweredOnTime(list[0] as Message)).toBe(true);
    expect(wasAnsweredOnTime(list[2] as Message)).toBe(false);
  });
});

describe('Reclamações: 5 dias úteis (RN-POP-08; AC-M11-08)', () => {
  it('o prazo é o fim do expediente do 5º dia útil', () => {
    expect(complaintDueAt(at('2026-11-04', '10:00'))).toBe(at('2026-11-11', '18:00'));
    expect(complaintDueAt(at('2026-11-06', '17:00'))).toBe(at('2026-11-13', '18:00'));
  });

  it('aberta em dia não útil conta a partir do próximo dia útil', () => {
    expect(complaintDueAt(at('2026-11-07', '10:00'))).toBe(at('2026-11-16', '18:00'));
  });

  it('aberta há 8 dias úteis está vencida', () => {
    const opened = at('2026-10-21', '10:00');
    const complaint = { status: 'open' as const, dueAt: complaintDueAt(opened) };
    expect(isComplaintOverdue(complaint, at('2026-11-04', '09:00'))).toBe(true);
    expect(
      isComplaintOverdue({ ...complaint, status: 'answered' }, at('2026-11-04', '09:00')),
    ).toBe(false);
    expect(
      isComplaintOverdue(
        { status: 'in_progress', dueAt: at('2026-11-10', '18:00') },
        at('2026-11-04', '09:00'),
      ),
    ).toBe(false);
  });
});
