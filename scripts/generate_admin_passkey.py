import base64
import getpass
import hashlib
import os

ITERATIONS = 210000


def to_b64(data: bytes) -> str:
    return base64.b64encode(data).decode("utf-8")


def main() -> None:
    print("Generate admin passkey hash for scripts/auth.js")
    passcode = getpass.getpass("Enter new passcode (min 10 chars): ")
    if len(passcode) < 10:
      print("Passcode too short.")
      return

    confirm = getpass.getpass("Confirm passcode: ")
    if passcode != confirm:
        print("Passcodes do not match.")
        return

    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", passcode.encode("utf-8"), salt, ITERATIONS, dklen=32)

    print("\nPaste these values into scripts/auth.js AUTH object:\n")
    print(f'passcodeHashB64: "{to_b64(digest)}",')
    print(f'passcodeSaltB64: "{to_b64(salt)}",')
    print(f"iterations: {ITERATIONS},")


if __name__ == "__main__":
    main()
