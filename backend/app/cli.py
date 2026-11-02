"""Owner password reset (there is no email service, so this runs on the server).

    python -m app.cli reset-password
"""
import getpass
import sys

from sqlalchemy import delete, update

from .db import make_engine, owners, sessions
from .security import hash_password


def reset_password():
    pw = getpass.getpass("New password (10+ characters): ")
    if len(pw) < 10 or pw != getpass.getpass("Type it again: "):
        sys.exit("Passwords must match and be at least 10 characters.")
    with make_engine().begin() as conn:
        if not conn.execute(update(owners).values(password_hash=hash_password(pw))).rowcount:
            sys.exit("No owner account exists yet.")
        conn.execute(delete(sessions))  # log out every device
    print("Password changed. All devices are logged out.")


if __name__ == "__main__":
    if sys.argv[1:] != ["reset-password"]:
        sys.exit(__doc__)
    reset_password()
