# convert_csv_to_txt.py
import csv

input_csv = "Data/ingouda_onderwerpen.csv"
output_txt = "Data/ingouda_onderwerpen.txt"

with open(input_csv, newline='', encoding='utf-8') as csvfile, \
     open(output_txt, 'w', encoding='utf-8') as txtfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        # Write each field as "Header: Value"
        for key, value in row.items():
            txtfile.write(f"{key}: {value}\n")
        txtfile.write("\n" + "-"*40 + "\n\n")  # Separator between entries

print(f"Converted {input_csv} to {output_txt}")