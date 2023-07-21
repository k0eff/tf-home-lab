include ./.env
export

init:
	terraform init

plan:
	rm -f plan.plan
	terraform plan -out plan.plan


apply:
	terraform apply plan.plan 

destroy:
	terraform destroy

