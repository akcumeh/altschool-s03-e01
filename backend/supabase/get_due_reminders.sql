-- Reminder sources:
--   'creator' - the schedule the organiser set on the event (events.reminder_hours_before)
--   'eventee' - the personal reminder the ticket holder set (tickets.reminder_hours_before)
-- Both can fire for the same ticket; each is logged separately in reminder_logs.
-- Eventees may hold pending (registered, unpaid) tickets and still get reminders.

alter table reminder_logs
    add column if not exists source text not null default 'creator';

create or replace function get_due_reminders()
returns table (
    ticket_id     uuid,
    event_id      uuid,
    email         text,
    name          text,
    title         text,
    starts_at     timestamptz,
    location      text,
    qr_code       text,
    ticket_status ticket_status,
    source        text
)

language sql
as $$
    -- Organiser-scheduled reminders
    select
        t.id            as ticket_id,
        e.id            as event_id,
        u.email,
        u.name,
        e.title,
        e.starts_at,
        e.location,
        t.qr_code,
        t.status        as ticket_status,
        'creator'       as source
    from tickets t
    join events e on t.event_id = e.id
    join eventful_users u on t.eventee_id = u.id
    where t.status <> 'cancelled'
      and e.starts_at > now()
      and e.reminder_hours_before is not null
      and e.starts_at <= now() + (e.reminder_hours_before || ' hours')::interval
      and not exists (
          select 1 from reminder_logs rl
          where rl.ticket_id = t.id and rl.source = 'creator'
      )

    union all

    -- Personal reminders set by the eventee
    select
        t.id            as ticket_id,
        e.id            as event_id,
        u.email,
        u.name,
        e.title,
        e.starts_at,
        e.location,
        t.qr_code,
        t.status        as ticket_status,
        'eventee'       as source
    from tickets t
    join events e on t.event_id = e.id
    join eventful_users u on t.eventee_id = u.id
    where t.status <> 'cancelled'
      and e.starts_at > now()
      and t.reminder_hours_before is not null
      and e.starts_at <= now() + (t.reminder_hours_before || ' hours')::interval
      and not exists (
          select 1 from reminder_logs rl
          where rl.ticket_id = t.id and rl.source = 'eventee'
      );
$$;
