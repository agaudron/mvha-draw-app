import re
rest_of_b3 = "Nick Kennewell (Gloucester MNCHL M) & Dakota sipek (Tigers MNCHL M)"
print(re.split(r'\s{3,}|(?<=\))\s+(?=\S)', rest_of_b3))
