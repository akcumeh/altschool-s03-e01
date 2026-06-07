create or replace function get_due_reminders()
returns table (
    ticket_id   uuid,
    email       text,
    name        text,
    title       text,
    starts_at   timestamptz,
    location    text,
    qr_code     text
)

language sql
as $$
    select
        t.id            as ticket_id,
        u.email,
        u.name,
        e.title,
        e.starts_at,
        e.location,
        t.qr_code
    from tickets t
    join events   e on t.event_id   = e.id
    join eventful_users   u on t.eventee_id = u.id
    where t.status = 'paid'
      and t.qr_code is not null
      and (
          (t.reminder_hours_before is not null
            and e.starts_at <= now() + (t.reminder_hours_before || ' hours')::interval)
        or
          (t.reminder_hours_before is null
            and e.reminder_hours_before is not null
            and e.starts_at <= now() + (e.reminder_hours_before || ' hours')::interval)
      )
      and not exists (
          select 1 from reminder_logs rl where rl.ticket_id = t.id
      );
$$;
