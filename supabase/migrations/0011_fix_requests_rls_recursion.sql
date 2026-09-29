create or replace function user_is_assignee_of_request(req_id uuid)
returns boolean as $$
  select exists (
    select 1 from request_assignees ra
    where ra.request_id = req_id
    and ra.user_id = auth.uid()
  );
$$ language sql security definer stable;

create or replace function user_created_request(req_id uuid)
returns boolean as $$
  select exists (
    select 1 from requests r
    where r.id = req_id
    and r.created_by = auth.uid()
  );
$$ language sql security definer stable;

drop policy if exists "الموظف يشوف طلباته وفريق التنسيق يشوف الكل" on requests;

create policy "الموظف يشوف طلباته وفريق التنسيق يشوف الكل" on requests
  for select using (
    is_coordination_manager()
    or auth.uid() = created_by
    or user_is_assignee_of_request(requests.id)
  );

drop policy if exists "الموظف يشوف تعييناته وفريق التنسيق يشوف الكل" on request_assignees;

create policy "الموظف يشوف تعييناته وفريق التنسيق يشوف الكل" on request_assignees
  for select using (
    is_coordination_manager()
    or user_id = auth.uid()
    or user_created_request(request_assignees.request_id)
  );
