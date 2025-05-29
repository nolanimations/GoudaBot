# import asyncio

# class SimpleCache:
#     def __init__(self):
#         self.cache = {}

#     def set(self, key, value, ttl_seconds: int):
#         expiration_time = asyncio.get_event_loop().time() + ttl_seconds
#         self.cache[key] = (value, expiration_time)

#     def get(self, key):
#         entry = self.cache.get(key)
#         if not entry:
#             return None
#         value, expiration_time = entry
#         if expiration_time < asyncio.get_event_loop().time():
#             self.cache.pop(key, None)
#             return None
#         return value

#     def cleanup(self):
#         now = asyncio.get_event_loop().time()
#         expired_keys = [key for key, (_, exp) in self.cache.items() if exp < now]
#         for key in expired_keys:
#             self.cache.pop(key, None)

# Deze shit wordt niet gebruikt...