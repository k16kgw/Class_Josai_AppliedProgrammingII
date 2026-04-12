.PHONY: start build clean install

start:
	myst start

build:
	myst build --html

clean:
	rm -rf _build

install:
	uv pip install -r requirements.txt
