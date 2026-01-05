# User Management

Isaac supports multiple users with role-based permissions.

## User Accounts

### Creating Users

Admins can create new users:
1. Go to Settings > User Management
2. Click "Add User"
3. Enter username (3-50 chars, alphanumeric + . _ -)
4. Enter email (optional)
5. Enter display name
6. Set password (8+ characters)
7. Assign role
8. Click Create

### User Properties

| Property | Description |
|----------|-------------|
| Username | Login name (required, unique) |
| Email | Contact email (optional) |
| Display Name | Shown in UI |
| Role | Permission level |
| Active | Enable/disable account |
| Last Login | Timestamp of last login |

### Managing Users

Admins can:
- View all users
- Edit user details
- Change user roles
- Enable/disable accounts
- Reset passwords
- Delete users

**Note:** Admins cannot modify their own role or disable themselves.

## Roles & Permissions

### Built-in Roles

| Role | Description |
|------|-------------|
| **Admin** | Full access to everything |
| **Editor** | Create/edit farm data, read-only admin settings |
| **Viewer** | Read-only access to all features |

### Permission Categories

| Category | Actions |
|----------|---------|
| Users | View, create, edit, delete users |
| Roles | View, create, edit, delete roles |
| Settings | View, edit, email config, calendar config |
| Animals | View, create, edit, delete |
| Plants | View, create, edit, delete |
| Tasks | View, create, edit, delete |
| Equipment | View, create, edit, delete |
| Vehicles | View, create, edit, delete |
| Production | View, create, edit, delete |

### Custom Roles

Admins can create custom roles:
1. Go to Settings > Role Management
2. Click "Add Role"
3. Enter role name and description
4. Set color (for UI display)
5. Check permissions for each category
6. Save

Example custom roles:
- **Farm Hand** - Can view/edit animals and plants, no equipment access
- **Mechanic** - Full vehicle/equipment access, read-only for animals
- **Guest** - View-only access to dashboard

### Role Colors

Roles can have custom colors:
- Displayed on user list
- Helps quickly identify user permissions
- Built-in: Admin (red), Editor (blue), Viewer (gray)

## Authentication

### Login
- Username and password
- Session expires after 30 days
- Logout invalidates session immediately

### Sessions
- Token-based authentication
- Bearer token in Authorization header
- Cookie fallback for browsers
- One active session per user

### Password Security
- Minimum 8 characters
- SHA-256 hashed with salt
- Secure token generation
- Passwords never logged or displayed

## Kiosk Mode

Special mode for shared display terminals.

### What is Kiosk Mode?
- Dedicated dashboard display
- No password required to login
- Perfect for barn/kitchen mounted screens
- Shows dashboard only (limited navigation)

### Setting Up Kiosk
1. Create a user named "kiosk" (or similar)
2. Assign Viewer role
3. Enable kiosk mode on the account
4. Use auto-login on the display device

### Kiosk Security
- Limited permissions (view-only)
- Cannot change settings
- Cannot manage users
- Session stays active indefinitely

## Initial Setup

On first install (no users exist):
1. Visit the web interface
2. Setup page appears automatically
3. Create your admin account
4. This becomes the primary admin

**Note:** Setup only works when no users exist. After first user is created, new users must be added by an admin.

## Password Reset

### For Users (if email configured)
Coming in future version.

### For Admins
Reset via database:
```bash
cd /opt/isaac/backend
source venv/bin/activate
python3 -c "
from models.database import engine
from sqlalchemy import text
import asyncio

async def reset():
    async with engine.begin() as conn:
        await conn.execute(text('DELETE FROM users'))
        print('All users deleted. Visit web UI to create new admin.')

asyncio.run(reset())
"
sudo systemctl restart isaac-backend
```

### Admin Password Reset (Keep Other Users)
Admins can reset any user's password:
1. Go to Settings > User Management
2. Find the user
3. Click "Reset Password"
4. Enter new password
5. User logs in with new password

## Best Practices

1. **Create individual accounts** - Don't share logins
2. **Use strong passwords** - 12+ characters recommended
3. **Assign minimum permissions** - Only what's needed
4. **Review accounts regularly** - Remove unused accounts
5. **Use kiosk mode** - For shared displays, not personal logins
