#    AlgoPiper: a visual tool to create modular, reusable and distributed
#    computational workflows - Copyright (C) 2015 Thibauld Favre <tfavre@gmail.com>
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.
FROM ubuntu:15.10
MAINTAINER Abdelrahman H. Ibrahim <abdelrahman.hosny@hotmail.com>
RUN apt-get update && \
apt-get install -y nodejs npm nodejs-legacy && \
apt-get clean && \
rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
ADD package.json /
RUN mkdir workflow-log && \
npm install

ADD red.js /
ADD settings.js /
ADD sample-flow.json /
ADD ./bin /bin/
ADD ./editor /editor
ADD ./locales /locales
ADD ./nodes /nodes
ADD ./public /public
ADD ./red /red
ADD ./test /test

EXPOSE 8765
ENTRYPOINT ["/usr/bin/nodejs","red.js", "sample-flow.json"]
