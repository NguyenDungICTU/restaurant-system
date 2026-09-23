# Employee account management API

Only an authenticated `QUAN_LY` can use these endpoints.

## Create account
`POST /api/employees`

```json
{
  "full_name": "Nguyen Van A",
  "phone": "0912345678",
  "username": "nguyenvana",
  "role": "PHUC_VU",
  "status": "HOAT_DONG"
}
```

Roles: `QUAN_LY`, `PHUC_VU`, `BEP`, `THU_NGAN`.
Statuses: `HOAT_DONG`, `DA_NGHI`.

The successful response contains `temporary_password` exactly once. Only its bcrypt hash is stored.

## Immediate duplicate checks for form fields
- `GET /api/employees/availability/username?username=nguyenvana`
- `GET /api/employees/availability/phone?phone=0912345678`

The frontend can call these on blur/debounced input. `POST /api/employees` also enforces uniqueness and returns HTTP 409 with `detail.field` equal to `username` or `phone`.

## Mark employee as left / active
`PATCH /api/employees/{id}/status`

```json
{"status":"DA_NGHI"}
```

When changed to `DA_NGHI`, all active sessions are revoked immediately. Existing audit/history rows remain intact.
